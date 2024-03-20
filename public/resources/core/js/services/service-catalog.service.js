(function() {
	'use strict';

	angular.module('app').factory('ServiceCatalog', ['$q', '$resource', 'URLS', ServiceCatalogService]);

	function ServiceCatalogService($resource, URLS) {
		const resource = $resource(URLS.SERVICE_CATALOG, { serviceSpecificationId: '@serviceSpecificationId' })
		const listResource = $resource(URLS.SERVICE_CATALOG, {})

		function getServiceSpecifications(search) {
			let promise = new Promise(function(resolve, reject) {
				let params = {}

				if (search != null && search != '') {
					params = { search: search };
				};

				listResource.query(
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
					() => {
						resolve()
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
				listResource.save(
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

		return {
			getServiceSpecifications: getServiceSpecifications,
			getServiceSpecficiation: getServiceSpecficiation,
			udpateServiceSpecification: updateServiceSpecification,
			createServiceSpecification: createServiceSpecification,
			deleteServiceSpecification: deleteServiceSpecification,
			exists: exists
		};
	}
})();
