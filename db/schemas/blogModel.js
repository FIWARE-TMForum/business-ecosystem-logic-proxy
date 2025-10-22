const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: String,
  author: String,
  partyId: String,
  date: { type: Date, default: Date.now },
  content: String
});

module.exports = mongoose.model('Blog', blogSchema);
