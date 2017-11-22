/* Copyright (c) 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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

const cssFilesToInject = [
    'bootstrap-3.3.5/css/bootstrap',
    'font-awesome-4.5.0/css/font-awesome',
    'intl-tel-input-8.4.7/css/intlTelInput',
    'core/css/default-theme'
].map(function (path) {
    return 'resources/' + path + '.css';
});

const jsDepFilesToInject = [
    // Dependencies:
    'jquery-1.11.3/js/jquery',
    'bootstrap-3.3.5/js/bootstrap',
    'moment-2.10.6/js/moment',
    'intl-tel-input-8.4.7/js/intlTelInput',
    'angular-1.4.7/js/angular',
    // Angular Dependencies:
    'angular-1.4.7/js/angular-messages',
    'angular-1.4.7/js/angular-moment',
    'angular-1.4.7/js/angular-resource',
    'angular-1.4.7/js/angular-ui-router',
    'angular-1.4.7/js/international-phone-number'
].map(function (path) {
    return 'resources/' + path + '.js';
});

let jsAppFilesToInject = [
    'app.config',
    'app.filters',
    'app.directives',
    'directives/product-offering.directives',
    'services/user.service',
    'services/payment.service',
    'services/product-specification.service',
    'services/product-category.service',
    'services/product-offering.service',
    'services/product-catalogue.service',
    'services/sharing-models.service',
    'services/asset.service',
    'services/asset-type.service',
    'services/product-order.service',
    'services/shopping-cart.service',
    'services/inventory-product.service',
    'services/utils.service',
    'services/party.individual.service',
    'services/billing-account.service',
    'services/customer.service',
    'services/customer-account.service',
    'controllers/form-wizard.controller',
    'controllers/flash-message.controller',
    'controllers/user.controller',
    'controllers/search-filter.controller',
    'controllers/payment.controller',
    'controllers/product.controller',
    'controllers/product-specification.relationship.controller',
    'controllers/product-category.controller',
    'controllers/product-offering.controller',
    'controllers/product-offering.price.controller',
    'controllers/product-catalogue.controller',
    'controllers/sharing-models.controller',
    'controllers/transactions.controller',
    'controllers/sharing-reports.controller',
    'controllers/purchase-options.controller',
    'controllers/product-order.controller',
    'controllers/message.controller',
    'controllers/inventory-product.controller',
    'controllers/unauthorized.controller',
    'controllers/party.individual.controller',
    'controllers/party.contact-medium.controller',
    'controllers/pager.controller',
    'controllers/billing-account.controller',
    'controllers/customer.controller',
    'routes/offering.routes',
    'routes/settings.routes',
    'routes/inventory.routes',
    'routes/inventory.product-order.routes',
    'routes/inventory.product.routes',
    'routes/shopping-cart.routes',
    'routes/unauthorized.routes'
].map(function (path) {
    return 'resources/core/js/' + path + '.js';
});

// Stock dependencies
let jsStockFilesToInject = [
    'routes/stock.routes',
    'routes/stock.product.routes',
    'routes/stock.product-offering.routes',
    'routes/stock.product-catalogue.routes',
    'routes/rss.routes',
    'routes/rss.sharing-models.routes',
    'routes/rss.transactions.routes',
    'routes/rss.reports.routes'
].map(function (path) {
    return 'resources/core/js/' + path + '.js';
});

// Admin dependencies
let jsAdminFilesToInject = [
    'routes/admin.routes',
    'routes/admin.product-category.routes'
].map(function (path) {
    return 'resources/core/js/' + path + '.js';
});

if (process.env.NODE_ENV == 'production') {
    // If the software is is production all js files have been minimized into bae.min.js
    jsAppFilesToInject = [
        'resources/core/js/bae.min.js'
    ];
    jsStockFilesToInject = [];
    jsAdminFilesToInject = [];
}

exports.imports = {
    cssFilesToInject: cssFilesToInject,
    jsDepFilesToInject: jsDepFilesToInject,
    jsAppFilesToInject: jsAppFilesToInject,
    jsStockFilesToInject: jsStockFilesToInject,
    jsAdminFilesToInject: jsAdminFilesToInject
};

