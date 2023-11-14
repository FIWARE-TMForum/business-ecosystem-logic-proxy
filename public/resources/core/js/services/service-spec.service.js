/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
 * 
 * This file belongs to the bbusiness-ecosystem-logic-proxy of the
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

(function() {
	'use strict';

	angular.module('app').factory('ServiceSpecification', [
		'$resource',
		'URLS',
		'LIFECYCLE_STATUS',
		'User',
		ServiceSpecService
	]);

	function ServiceSpecService($resource, URLS, LIFECYCLE_STATUS, User) {
		const resource = $resource(URLS.SERVICE_CATALOG + '/serviceSpecification/:serviceSpecificationId', {
			serviceSpecificationId: '@serviceSpecificationId'
		}, {
            update: { method: 'PATCH' }
        })

		function getServiceSpecifications(search) {
			let params = {}

			if (search.offset >= 0) {
				params.offset = search.offset
			}

			if (search.size >= 0) {
				params.size = search.size
			}

			if (search.lifecycleStatus) {
				params.lifecycleStatus = search.lifecycleStatus
			}

			let promise = new Promise(function(resolve, reject) {
				resource.query(
					params,
					(itemList) => {
						resolve(itemList);
					},
					(reponse) => {
						reject(reponse);
					});
			});
			return promise;
		}

		function getServiceSpecficiation(serviceSpecificationId) {
			let promise = new Promise(function(resolve, reject) {
				let params = { serviceSpecificationId: serviceSpecificationId };
				resource.get(params,
					(serviceSpecification) => {
						resolve(serviceSpecification)
					},
					(response) => {
						reject(response)
					});
			});
			return promise;
		}

		function updateServiceSpecification(serviceSpecificationId, data) {
			let promise = new Promise(function(resolve, reject) {
				resource.update({ serviceSpecificationId: serviceSpecificationId },
					data,
					(updated) => {
						resolve(updated)
					},
					(response) => {
						reject(response)
					}
				);
			});
			return promise;
		}

		function createServiceSpecification(data) {
			let promise = new Promise(function(resolve, reject) {
				resource.save(
					data,
					(created) => {
						resolve(created);
					},
					(response) => {
						reject(response);
					}
				);
			});
			return promise;
		}

		function deleteServiceSpecification(serviceSpecificationId) {
			let promise = new Promise(function(resolve, reject) {
				resource.delete({ serviceSpecificationId: serviceSpecificationId },
					() => {
						resolve();
					},
					(response) => {
						reject(response);
					}
				);
			});
			return promise;
		}

		function exists(params) {
			let promise = new Promise(function(resolve, _reject) {
				resource.query(params,
					(serviceSpecificationList) => {
						resolve(serviceSpecificationList)
					}
				);
			});
			return promise;
		}

		function buildInitialData() {
            return {
                lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                relatedParty: [User.serialize()]
            };
        }

		return {
			getServiceSpecifications: getServiceSpecifications,
			getServiceSpecficiation: getServiceSpecficiation,
			udpateServiceSpecification: updateServiceSpecification,
			createServiceSpecification: createServiceSpecification,
			deleteServiceSpecification: deleteServiceSpecification,
			exists: exists,
			buildInitialData: buildInitialData
		};
	}
})();
