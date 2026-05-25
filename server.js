const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();

const authRoutes = require('./routes/auth');
const incidentRoutes = require('./routes/incident');
const groupsRoutes = require('./routes/groups');
const notificationRoutes = require('./routes/notifications');
const resourcesRoutes = require('./routes/resources');
const hotlinesRoutes = require('./routes/hotlines');

app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());

app.use('/api', authRoutes);
app.use('/api', incidentRoutes);
app.use('/api', groupsRoutes);
app.use('/api', notificationRoutes);
app.use('/api', resourcesRoutes);
app.use('/api/hotlines', hotlinesRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});