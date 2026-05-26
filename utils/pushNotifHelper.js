const pool = require('../db');

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function savePushToken(user_id, token) {
  await pool.query(`
    UPDATE users
    SET expo_push_token = $1
    WHERE user_id = $2
  `, [token, user_id]);
}

async function sendExpoPushNotification(token, title, body, data = {}) {
  if (!token || !token.startsWith('ExponentPushToken')) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: token,
      sound: 'default',
      title,
      body,
      data
    })
  });
}

async function getAuthoritiesToNotify(group_id, incidentLat, incidentLng) {
  const membersResult = await pool.query(`
    SELECT u.user_id, u.name, u.expo_push_token
    FROM group_membership gm
    JOIN users u ON gm.user_id = u.user_id
    WHERE gm.group_id = $1
    AND u.role = 'authority'
    AND u.expo_push_token IS NOT NULL
  `, [group_id]);

  return membersResult.rows;
}

async function notifyAuthorities({
  group_id,
  incident_type,
  location,
  latitude,
  longitude,
  report_id,
  status,
  user_id
}) {

  // GET REPORTER INFO
  const reporterResult = await pool.query(`
    SELECT name
    FROM users
    WHERE user_id = $1
  `, [user_id]);

  const reporterName =
    reporterResult.rows[0]?.name || 'Unknown Reporter';

  const authorities = await getAuthoritiesToNotify(
    group_id,
    latitude,
    longitude
  );

  const title = '🚨 New Incident Alert';

  const body =
    `${reporterName} reported a ${incident_type}`;

  // IMPORTANT
  const dataPayload = {
    navigateTo: 'Alerts',

    notification_id: report_id,

    report_id,

    reporter_name: reporterName,

    location,

    incident_type,

    status,
  };

  for (const authority of authorities) {

    await sendExpoPushNotification(
      authority.expo_push_token,
      title,
      body,
      dataPayload
    );

    await pool.query(`
      INSERT INTO notifications
      (
        user_id,
        report_id,
        title,
        body,
        data
      )
      VALUES($1,$2,$3,$4,$5)
    `, [
      authority.user_id,
      report_id,
      title,
      body,
      JSON.stringify(dataPayload)
    ]);
  }
}

module.exports = {
  savePushToken,
  notifyAuthorities,
  sendExpoPushNotification
};