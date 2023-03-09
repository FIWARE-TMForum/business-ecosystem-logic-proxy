/* Copyright (c) 2015 - 2023 CoNWeT Lab., Universidad Politécnica de Madrid
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

var recommendationModel = require('../db/schemas/recommendations')

var recommendationService = (function() {
	var getRecomList = function(req, res) {
		try {
			var userName = req.params.id;
			if (userName) {
				recommendationModel.find({ userId: userName }, function(err, result) {
					if (err) {
						res.status(500).json({ error: err.message });
					} else {
						res.status(200).json(result[0]);
					}
				})
			} else {
				res.status(400).json({ error: 'userId missing' })
			}
		} catch (e) {
			res.status(400).json({ error: e.message + 'Invalid body' });
		}
	};

	var setRecomList = function(req, res) {
		var body = JSON.parse(req.body);
		var userId = body.userId;
		var categories = body.categories;

		try {
			if (userId) {
				recommendationModel.findOneAndUpdate({ userId: userId }, { $set: { userId: userId, categories: categories } }, { new: true, upsert: true }, function(err, rawResp) {
					if (err) {
						res.status(500).json({ error: err.message });
					} else {
						res.status(200).json(rawResp);
					}
				});
			} else {
				res.status(422).json({ error: 'userId missing' });
			}
		} catch (e) {
			res.status(400).json({ error: e.message + 'Invalid body' });
		}
	}
	return {
		getRecomList: getRecomList,
		setRecomList: setRecomList
	};
})();

exports.recommendationService = recommendationService;
