const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); 


dotenv.config();
const app = express();
const authRoutes = require('./routes/auth');
const incidentRoutes = require('./routes/incident');
const groupsRoutes = require('./routes/groups');

app.use(cors({
  origin: '*', 
  credentials: true
}));

app.use(express.json());

app.use('/api', authRoutes);
app.use('/uploads', express.static('uploads'));
app.use('/api', incidentRoutes);
app.use('/api', groupsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
