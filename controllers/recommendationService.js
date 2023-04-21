/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

const recommendationModel = require('../db/schemas/recommendations')

var recommendationService = (function() {
	const getAllRecomList = function(req, res) {
		recommendationModel.find({}, (err, result) => {
			if (err) {
				res.status(500).json({ error: err.message });
			} else {
				res.status(200).json(result);
			}
		});
	}

	const getRecomList = function(req, res) {
		console.log('GET RECOM LIST')
		try {
			var userName = req.params.id;
			console.log(userName);
			if (userName) {
				recommendationModel.find({ userId: userName }, function(err, result) {
					if (err) {
						res.status(500).json({ error: err.message });
					} else {
						console.log('THE RECOM')
						console.log()
						if (result.length == 0) {
							res.status(404).end();
						} else {
							res.status(200).json(result[0]);	
						}
					}
				})
			} else {
				res.status(400).json({ error: 'userId missing' })
			}
		} catch (e) {
			res.status(400).json({ error: e.message + 'Invalid body' });
		}
	};

	const setRecomList = function(req, res) {
		const body = JSON.parse(req.body);
		const userId = body.userId;

		let categories = body.categories;
		let promotions = body.promotions;

		let set = { userId: userId}

		if (categories != null) {
			set[categories] = categories
		}

		if (promotions != null) {
			set[promotions] = promotions
		}

		try {
			if (userId) {
				recommendationModel.findOneAndUpdate(
					{ userId: userId },
					{ $set:  set},
					{ new: true, upsert: true },
 
					(err, rawResp) => {
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
		setRecomList: setRecomList,
		getAllRecomList: getAllRecomList
	};
})();

exports.recommendationService = recommendationService;
