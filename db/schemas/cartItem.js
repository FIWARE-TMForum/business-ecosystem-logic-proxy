var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var cartItemSchema = new Schema({
    user: { type: String, required: true },
    itemId: { type: String, required: true },
    itemObject: { type: Object, required: true }
});

cartItemSchema.index({ user: 1, itemId: 1 }, { unique: true });

module.exports = mongoose.model('CartItem', cartItemSchema);