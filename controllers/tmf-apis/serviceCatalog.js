const utils = require('./../../lib/utils')

const serviceCatalog = (function() {

	var validators = {
		GET: [utils.validateLoggedIn],
		POST: [utils.validateLoggedIn],
		PATCH: [utils.validateLoggedIn],
		PUT: [utils.validateLoggedIn],
		DELETE: [utils.validateLoggedIn]
	};

	var checkPermissions = function(req, callback) {
		var reqValidators = [];

		for (var i in validators[req.method]) {
			reqValidators.push(validators[req.method[i].bind(this, req)]);
			async.series(reqValidators, callback);
		}
	};

	var executePostValidation = function(_req, callback) {
		callback(null);
	};

	var handleAPIError = function(_req, callback) {
		callback(null);
	};

	return {
		checkPermissions: checkPermissions,
		executePostValidation: executePostValidation,
		handleAPIError: handleAPIError
	}
})();

exports.serviceCatalog = serviceCatalog;
