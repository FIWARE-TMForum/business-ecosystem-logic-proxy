/* Copyright (c) 2015 - 2018 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var accessTokenServiceSchema = new Schema({
    appId: {type: String, required: true},
    userId: { type: String, required: true },
    state: {type: String, required: false},
    authToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expire: { type: Date, default: () => Date.now() + 3600000 }
});

accessTokenServiceSchema.index({appId: 1, userId: 1}, {unique: true});

module.exports = mongoose.model('accessTokenService', accessTokenServiceSchema);