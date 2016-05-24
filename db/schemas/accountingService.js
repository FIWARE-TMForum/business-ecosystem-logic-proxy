var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var accountingServiceSchema = new Schema({
    url: {type: String, required: true},
    apiKey: {type: String, required: true},
    state: {type: String, required: true}
});

accountingServiceSchema.index({url: 1, apiKey: 1}, {unique: true});

module.exports = mongoose.model('AccountingService', accountingServiceSchema);