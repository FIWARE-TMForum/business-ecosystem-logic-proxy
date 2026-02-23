/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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
		clientID: 'client'
	},
	roles: {
		admin: 'provider',
		seller: 'Seller',
		customer: 'Buyer',
		orgAdmin: 'orgAdmin',
		certifier: 'certifier',
		sellerOperator: 'SellerOperator',
		buyerOperator: 'BuyerOperator'
	},
	billingAccountOwnerRole: 'owner',
	endpoints: {
		account: {
			path: 'account',
			apiPath: '/api',
			host: 'host.docker.internal',
			port: '8639',
			appSsl: false
		},
		management: {
			path: 'management',
			apiPath: '',
			host: 'localhost',
			port: 7496,
			appSsl: false
		},
		catalog: {
			path: 'catalog',
			apiPath: '/api',
			host: 'catalog.com',
			port: 99,
			appSsl: false
		},
		resource: {
			path: 'resource',
			apiPath: '/api',
			host: 'resource.com',
			port: '8636',
			appSsl: false
		},
		service: {
			path: 'service',
			apiPath: '/api',
			host: 'service.com',
			port: '8637',
			appSsl: false
		},
		ordering: {
			path: 'ordering',
			apiPath: '/api',
			host: 'ordering.com',
			port: 189,
			appSsl: false
		},
		inventory: {
			path: 'inventory',
			apiPath: '/api',
			host: 'inventory.com',
			port: 475,
			appSsl: false
		},
		serviceInventory: {
			path: 'serviceInventory',
			apiPath: '/api',
			host: 'charging.docker',
			port: '8006',
			appSsl: false
		},
		resourceInventory: {
			path: 'resourceInventory',
			apiPath: '/api',
			host: 'tmforum-tm-forum-api-resource-inventory',
			port: '8080',
			appSsl: false
		},
		charging: {
			path: 'charging',
			apiPath: '',
			host: 'charging.com',
			port: 35,
			appSsl: false
		},
		rss: {
			path: 'rss',
			apiPath: '',
			host: 'charging.com',
			port: 35,
			appSsl: false
		},
		party: {
			path: 'party',
			apiPath: '/api',
			host: 'party.com',
			port: 74,
			appSsl: false
		},
		billing: {
			path: 'billing',
			apiPath: '/api',
			host: 'billing.com',
			port: 78,
			appSsl: false
		},
		customer: {
			path: 'customer',
			apiPath: '/api',
			host: 'customer.com',
			port: 82,
			appSsl: false
		},
		usage: {
			path: 'usage',
			apiPath: '/api',
			host: 'usage.com',
			port: 78,
			appSsl: false
		},
		sla: {
			path: 'SLAManagement',
			apiPath: '',
			host: 'localhost',
			port: 80,
			appSsl: false
		},
		reputation: {
			path: 'REPManagement',
			apiPath: '',
			host: 'localhost',
			port: 80,
			appSsl: false
		},
		quote: {
			path: 'quote',
			apiPath: '/api',
			host: 'quote.com',
			port: '8637',
			appSsl: false
		},
		revenue: {
			path: 'revenue',
			apiPath: '/revenue',
			host: 'revenue.com',
			port: '8637',
			appSsl: false
		},
		invoicing: {
			path: 'invoicing',
			apiPath: '/invoicing',
			host: 'invoicing.com',
			port: '8637',
			appSsl: false
		},
		search: {
			path: 'search',
			apiPath: '/search',
			host: 'search.com',
			port: '8637',
			appSsl: false
		},
		ai: {
			path: 'ai',
			apiPath: '/ai',
			host: 'ai.com',
			port: '8637',
			appSsl: false
		}
	},
	revenueModel: 30,
	indexes: {
		'engine': 'local', // 'elastic_indexes.js' if using elasticsearch
		'elasticHost': 'http://imaginary-elastic.docker:9200/' // hostname:port
	},
    defaultId: 'dft',
	operatorId: 'VAT-OP',
	partyLocation: 'https://mylocation.com/schema.json'
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
				error: emptyFunction,
				debug: emptyFunction
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
