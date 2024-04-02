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

const promotionModel = require('../db/schemas/promotions')
const recommendationModel = require('../db/schemas/recommendations')


const promotionService = (() => {
	const getPromotions = function(req, res) {
		promotionModel.find({}).then((result) => {
			res.status(200).json(result);
		}).catch((err) => {
			res.status(500).json({ error: err.message });
		});
	}

	const getPromotion = function(req, res) {
		try {
			const id = req.params.id;
			if (id) {
				promotionModel.find({ _id: id }).then((result) => {
					res.status(200).json(result[0]);
				}).catch((err) => {
					res.status(500).json({ error: err.message });
				})
			} else {
				res.status(400).json({ error: 'id missing' })
			}
		} catch (e) {
			res.status(400).json({ error: e.message + 'Invalid body' });
		}
	};

	const updateRecommendation = function(userId, categories, promotions) {
		return recommendationModel.findOneAndUpdate(
				{ userId: userId },
				{ $set: { userId: userId, categories: categories, promotions: promotions } },
				{ new: true, upsert: true });
	}

	const saveRecommendations = async function (userIds, promotionId) {
		let newIds = [];
		let recomendations = []

		// Get existing recommendation objects
		await Promise.all(userIds.map((userId) => {
			return new Promise((resolve, reject) => {
				recommendationModel.find({ userId: userId }).then((result) => {
					if (result.length == 0) {
						newIds.push(userId)
					} else {
						recomendations.push(result[0])
					}
					resolve(result);
				}).catch((err) => {
					newIds.push(userId)
				})
			});
		}))

		// Create new recommendations
		await Promise.all(newIds.map((userId) => {
			return updateRecommendation(userId, [], [promotionId])
		}));

		// Update existing recommendations
		await Promise.all(recomendations.map((recommendation) => {
			recommendation.promotions.push(promotionId);
			return updateRecommendation(recommendation.userId, recommendation.categories, recommendation.promotions);
		}));
	}

	const createPromotion = function(req, res) {
		const body = JSON.parse(req.body);

		const promotion = new promotionModel();
		if (!body.offeringId || !body.offeringName || !body.imageURL || !body.termsURL) {
			return res.status(422).json({ error: 'Missing required field' });
		}

		const imageName = body.imageURL.split('/')[body.imageURL.split('/').length - 1];

		promotion.offeringId = body.offeringId;
		promotion.offeringName = body.offeringName;
		promotion.imageName = imageName;
		promotion.imageURL = body.imageURL;
		promotion.termsURL = body.termsURL;

		try {
			promotion.save().then(async (data) => {
				// Save recomendations
				console.log(data);
				if (body.userIds != null && body.userIds.length > 0) {
					await saveRecommendations(body.userIds, data._id);
				}
				res.status(201).json();
			}).catch((err) => {
				console.log(err);
				res.status(500).json({ error: 'Unexpected error creating promotion' });
			});
		} catch (e) {
			console.log(e);
			res.status(400).json({ error: e.message + 'Invalid body' });
		}
	}

	const updatePromotion = function(req, res) {
		const body = JSON.parse(req.body);

		const offeringId = body.offeringId;
		const offeringName = body.offeringName;
        const imageURL = body.imageURL;
        const termsURL = body.termsURL;

		const id = req.params.id;

		const imageName = imageURL.split('/')[imageURL.split('/').length - 1];

		try {
			if (offeringId && imageURL && termsURL && offeringName) {
				promotionModel.findOneAndUpdate(
					{ _id: id },
					{ $set: {
						offeringId: offeringId,
						offeringName: offeringName,
						imageURL: imageURL,
						imageName: imageName,
						termsURL: termsURL
					}},
					{ new: true, upsert: true })
				.then((rawResp) => {
					res.status(200).json(rawResp);
				}).catch((err) => {
					res.status(500).json({ error: err.message });
				});
			} else {
				res.status(422).json({ error: 'Missing required field' });
			}
		} catch (e) {
			res.status(400).json({ error: e.message + 'Invalid body' });
		}
	}

	const deletePromotion = function(req, res) {
		const id = req.params.id;
        try {
			// Remove promotion from recomendations
			recommendationModel.updateMany(
				{ promotion: { "$eq": id } },
				{ $pull: { promotion:  id } })
			.then(() => {
				return promotionModel.deleteOne({_id: id}).then(() => {
					res.status(204).end();
				});
			}).catch((err) => {
				res.status(500).json({ error: 'Unexpected error updating recomendations' });
			})
        } catch (e) {
            res.status(500).json({ error: e.message + ' Invalid request' });
        }
	}

	return {
		getPromotions: getPromotions,
		getPromotion: getPromotion,
		updatePromotion: updatePromotion,
		createPromotion: createPromotion,
		deletePromotion: deletePromotion
	};
})();

exports.promotionService = promotionService;
