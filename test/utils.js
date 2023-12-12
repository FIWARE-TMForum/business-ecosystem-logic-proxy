/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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

var defaultConfig = {
	port: 7496,
	propagateToken: true,
	version: {
		version: '6.3.0',
		releaseDate: '2017-07-01',
		gitHash: '1234567890',
		doc: 'https://fiware-tmforum.github.io/Business-API-Ecosystem/',
		userDoc: 'http://business-api-ecosystem.readthedocs.io/en/develop'
	},
	proxy: {
		enabled: true,
		host: 'belp.fiware.org',
		secured: false,
		port: 7496
	},
	proxyPrefix: '',
	oauth2: {
		server: 'https://account.lab.fiware.org',
		clientID: 'client',
		roles: {
			admin: 'provider',
			seller: 'seller',
			customer: 'customer',
			orgAdmin: 'orgAdmin'
		}
	},
	endpoints: {
		management: {
			path: 'management',
			host: 'localhost',
			port: 7496,
			appSsl: false
		},
		catalog: {
			path: 'catalog',
			host: 'catalog.com',
			port: 99,
			appSsl: false
		},
		ordering: {
			path: 'ordering',
			host: 'ordering.com',
			port: 189,
			appSsl: false
		},
		inventory: {
			path: 'inventory',
			host: 'inventory.com',
			port: 475,
			appSsl: false
		},
		charging: {
			path: 'charging',
			host: 'charging.com',
			port: 35,
			appSsl: false
		},
		rss: {
			path: 'rss',
			host: 'rss.com',
			port: 753,
			appSsl: false
		},
		party: {
			path: 'party',
			host: 'party.com',
			port: 74,
			appSsl: false
		},
		billing: {
			path: 'billing',
			host: 'billing.com',
			port: 78,
			appSsl: false
		},
		customer: {
			path: 'customer',
			host: 'customer.com',
			port: 82,
			appSsl: false
		},
		usage: {
			path: 'usage',
			host: 'usage.com',
			port: 78,
			appSsl: false
		},
		sla: {
			path: 'SLAManagement',
			host: 'localhost',
			port: 80,
			appSsl: false
		},
		reputation: {
			path: 'REPManagement',
			host: 'localhost',
			port: 80,
			appSsl: false
		},
		resource: {
			path: 'resourceSpecification',
			host: 'resourceSpecification.com',
			port: 85,
			appSsl: false
		},
		service: {
			path: 'service',
			host: 'localhost',
			port: 86,
			appSsl: false
		}
	},
	billingAccountOwnerRole: 'bill receiver',
	revenueModel: 30,
	indexes: {
		'engine': 'local', // 'elastic_indexes.js' if using elasticsearch
		'elasticHost': 'http://imaginary-elastic.docker:9200/' // hostname:port
	}
};

exports.getDefaultConfig = function() {
	// Return a copy to avoid side effects
	return JSON.parse(JSON.stringify(defaultConfig));
};

exports.getIndexesPath = function() {
	return defaultConfig.indexes.indexFile;
};

var emptyFunction = function() { };
exports.emptyLogger = {
	logger: {
		getLogger: function() {
			return {
				info: emptyFunction,
				warn: emptyFunction,
				error: emptyFunction
			};
		}
	}
};


const MockStrategy = function MockStrategy(params, cb) {
	this.params = params;
	this.cb = cb;
}
MockStrategy.prototype.setProfileParams = function(err, profile, token, refreshToken) {
	this.userErr = err;
	this.profile = profile;
	this.token = token;
	this.refreshToken = refreshToken;
}
MockStrategy.prototype.userProfile = function(token, done) {
	this.token = token;
	done(this.userErr, this.profile);
}
MockStrategy.prototype.loginComplete = function() {
	this.cb(this.token, this.refreshToken, this.profile, 'cb');
}
MockStrategy.prototype.getParams = function() {
	return this.params;
}

exports.MockStrategy = MockStrategy;
