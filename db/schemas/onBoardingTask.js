var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var onBoardingTaskSchema = new Schema({
    href: { type: String, required: false },
    status: { type: String, required: true },
    description: { type: String, required: false },
    path: { type: String, required: true },
    creationDate: { type: String, required: false },
    completionDate: { type: String, required: false },
});

module.exports = mongoose.model('OnBoardingTask', onBoardingTaskSchema);
