/* Copyright (c) 2021 Future Internet Consulting and Development Solutions S.L.
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

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const idpSchema = new Schema({
    provider: { type: String, required: true },
    name: { type: String, required: true },
    server: { type: String, required: true },
    clientID: { type: String, required: true },
    callbackURL: { type: String, required: true },
    idpId: { type: String, required: true },
    description: { type: String, required: false },
    tokenKey: { type: String, required: true },
    tokenCrt: { type: String, required: true }
});

idpSchema.index({ idpId: 1 }, { unique: true });
idpSchema.index({ name: "text" });
idpSchema.index({ description: "text" });

module.exports = mongoose.model('Idp', idpSchema);
