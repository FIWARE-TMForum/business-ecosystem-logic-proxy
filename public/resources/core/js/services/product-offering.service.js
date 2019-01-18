/* Copyright (c) 2015 - 2018 CoNWeT Lab., Universidad Politécnica de Madrid
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

/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('Offering', ['$q', '$resource', 'URLS', 'CHARGE_PERIODS', 'CURRENCY_CODES', 'TAX_RATE', 'LIFECYCLE_STATUS', 'User', 'ProductSpec', 'Category', ProductOfferingService]);

    function ProductOfferingService($q, $resource, URLS, CHARGE_PERIODS, CURRENCY_CODES, TAX_RATE, LIFECYCLE_STATUS, User, ProductSpec, Category) {
        var resource = $resource(URLS.CATALOGUE_MANAGEMENT + '/:catalogue/:catalogueId/productOffering/:offeringId', {
            offeringId: '@id'
        }, {
            update: {method: 'PATCH'}
        });

        resource.prototype.formatCheapestPricePlan = formatCheapestPricePlan;
        resource.prototype.getCategories = getCategories;
        resource.prototype.getPicture = getPicture;
        resource.prototype.serialize = serialize;
        resource.prototype.appendPricePlan = appendPricePlan;
        resource.prototype.updatePricePlan = updatePricePlan;
        resource.prototype.removePricePlan = removePricePlan;
        resource.prototype.relationshipOf = relationshipOf;
        resource.prototype.relationships = relationships;

        var PATCHABLE_ATTRS = ['description', 'lifecycleStatus', 'name', 'version'];

        var EVENTS = {
            PRICEPLAN_UPDATE: '$pricePlanUpdate',
            PRICEPLAN_UPDATED: '$pricePlanUpdated',
            METRIC_UPDATE: '$metricUpdate',
            METRIC_UPDATED: '$metricUpdated'
        };

        var CHARGE_PERIOD = {};

        CHARGE_PERIODS.forEach(function (period) {
            CHARGE_PERIOD[period.title.toUpperCase()] = period.title.toLowerCase();
        });

        var CURRENCY_CODE = {};

        CURRENCY_CODES.forEach(function (code) {
            CURRENCY_CODE[code.value] = code.title;
        });

        var TYPES = {
            CHARGE_PERIOD: CHARGE_PERIOD,
            CURRENCY_CODE: CURRENCY_CODE,
            PRICE: {
                ONE_TIME: 'one time',
                RECURRING: 'recurring',
                USAGE: 'usage'
            },
            PRICE_ALTERATION: {
                DISCOUNT: {code: 'discount', name: 'Discount'},
                FEE: {code: 'fee', name: 'Fee'}
            },
            PRICE_ALTERATION_SUPPORTED: {
                PRICE_COMPONENT: 'Price component',
                DISCOUNT_OR_FEE: 'Discount or fee',
                NOTHING: 'None'
            },
            PRICE_CONDITION: {
                EQ: {code: 'eq', name: 'Equal'},
                LT: {code: 'lt', name: 'Less than'},
                LE: {code: 'le', name: 'Less than or equal'},
                GT: {code: 'gt', name: 'Greater than'},
                GE: {code: 'ge', name: 'Greater than or equal'}
            },
            LICENSE: {
                NONE: 'None',
                STANDARD: 'Standard open data license',
                WIZARD: 'Custom license (wizard)',
                FREETEXT: 'Custom license (free-text)'
            },
            SLA: {
                NONE: 'None',
                SPEC: 'Spec'
            },
            METRICS: {
                UPDATES: 'Updates rate',
                RESPTIME: 'Response time',
                DELAY: 'Delay'
            },
            MEASURESDESC: {
                UPDATES: 'Expected number of updates in the given period.',
                RESPTIME: 'Total amount of time to respond to a data request (GET).',
                DELAY: 'Total amount of time to deliver a new update (SUBSCRIPTION).'
            },
            TIMERANGE: {
                DAY: 'day',
                WEEK: 'week',
                MONTH: 'month'
            },
            UNITS: {
                MSEC: 'ms',
                SEC: 's',
                MIN: 'min'
            }
        };

        var exclusivities = [{name:'Exclusive'}, {name:'Non-exclusive'}];
        var sectors = [{name:'All sectors'},
                       {name:'Education'}, {name:'Financial'}, {name:'Healthcare'}, {name:'Industry'}, 
                       {name:'Transport'}, {name:'Government'}, {name:'Energy and Utilities'}];
        var regions = [ 
            {"name": "Afghanistan", "code": "AF"}, 
            {"name": "land Islands", "code": "AX"}, 
            {"name": "Albania", "code": "AL"}, 
            {"name": "Algeria", "code": "DZ"}, 
            {"name": "American Samoa", "code": "AS"}, 
            {"name": "AndorrA", "code": "AD"}, 
            {"name": "Angola", "code": "AO"}, 
            {"name": "Anguilla", "code": "AI"}, 
            {"name": "Antarctica", "code": "AQ"}, 
            {"name": "Antigua and Barbuda", "code": "AG"}, 
            {"name": "Argentina", "code": "AR"}, 
            {"name": "Armenia", "code": "AM"}, 
            {"name": "Aruba", "code": "AW"}, 
            {"name": "Australia", "code": "AU"}, 
            {"name": "Austria", "code": "AT"}, 
            {"name": "Azerbaijan", "code": "AZ"}, 
            {"name": "Bahamas", "code": "BS"}, 
            {"name": "Bahrain", "code": "BH"}, 
            {"name": "Bangladesh", "code": "BD"}, 
            {"name": "Barbados", "code": "BB"}, 
            {"name": "Belarus", "code": "BY"}, 
            {"name": "Belgium", "code": "BE"}, 
            {"name": "Belize", "code": "BZ"}, 
            {"name": "Benin", "code": "BJ"}, 
            {"name": "Bermuda", "code": "BM"}, 
            {"name": "Bhutan", "code": "BT"}, 
            {"name": "Bolivia", "code": "BO"}, 
            {"name": "Bosnia and Herzegovina", "code": "BA"}, 
            {"name": "Botswana", "code": "BW"}, 
            {"name": "Bouvet Island", "code": "BV"}, 
            {"name": "Brazil", "code": "BR"}, 
            {"name": "British Indian Ocean Territory", "code": "IO"}, 
            {"name": "Brunei Darussalam", "code": "BN"}, 
            {"name": "Bulgaria", "code": "BG"}, 
            {"name": "Burkina Faso", "code": "BF"}, 
            {"name": "Burundi", "code": "BI"}, 
            {"name": "Cambodia", "code": "KH"}, 
            {"name": "Cameroon", "code": "CM"}, 
            {"name": "Canada", "code": "CA"}, 
            {"name": "Cape Verde", "code": "CV"}, 
            {"name": "Cayman Islands", "code": "KY"}, 
            {"name": "Central African Republic", "code": "CF"}, 
            {"name": "Chad", "code": "TD"}, 
            {"name": "Chile", "code": "CL"}, 
            {"name": "China", "code": "CN"}, 
            {"name": "Christmas Island", "code": "CX"}, 
            {"name": "Cocos (Keeling) Islands", "code": "CC"}, 
            {"name": "Colombia", "code": "CO"}, 
            {"name": "Comoros", "code": "KM"}, 
            {"name": "Congo", "code": "CG"}, 
            {"name": "Congo, The Democratic Republic of the", "code": "CD"}, 
            {"name": "Cook Islands", "code": "CK"}, 
            {"name": "Costa Rica", "code": "CR"}, 
            {"name": "Cote D\'Ivoire", "code": "CI"}, 
            {"name": "Croatia", "code": "HR"}, 
            {"name": "Cuba", "code": "CU"}, 
            {"name": "Cyprus", "code": "CY"}, 
            {"name": "Czech Republic", "code": "CZ"}, 
            {"name": "Denmark", "code": "DK"}, 
            {"name": "Djibouti", "code": "DJ"}, 
            {"name": "Dominica", "code": "DM"}, 
            {"name": "Dominican Republic", "code": "DO"}, 
            {"name": "Ecuador", "code": "EC"}, 
            {"name": "Egypt", "code": "EG"}, 
            {"name": "El Salvador", "code": "SV"}, 
            {"name": "Equatorial Guinea", "code": "GQ"}, 
            {"name": "Eritrea", "code": "ER"}, 
            {"name": "Estonia", "code": "EE"}, 
            {"name": "Ethiopia", "code": "ET"}, 
            {"name": "Falkland Islands (Malvinas)", "code": "FK"}, 
            {"name": "Faroe Islands", "code": "FO"}, 
            {"name": "Fiji", "code": "FJ"}, 
            {"name": "Finland", "code": "FI"}, 
            {"name": "France", "code": "FR"}, 
            {"name": "French Guiana", "code": "GF"}, 
            {"name": "French Polynesia", "code": "PF"}, 
            {"name": "French Southern Territories", "code": "TF"}, 
            {"name": "Gabon", "code": "GA"}, 
            {"name": "Gambia", "code": "GM"}, 
            {"name": "Georgia", "code": "GE"}, 
            {"name": "Germany", "code": "DE"}, 
            {"name": "Ghana", "code": "GH"}, 
            {"name": "Gibraltar", "code": "GI"}, 
            {"name": "Greece", "code": "GR"}, 
            {"name": "Greenland", "code": "GL"}, 
            {"name": "Grenada", "code": "GD"}, 
            {"name": "Guadeloupe", "code": "GP"}, 
            {"name": "Guam", "code": "GU"}, 
            {"name": "Guatemala", "code": "GT"}, 
            {"name": "Guernsey", "code": "GG"}, 
            {"name": "Guinea", "code": "GN"}, 
            {"name": "Guinea-Bissau", "code": "GW"}, 
            {"name": "Guyana", "code": "GY"}, 
            {"name": "Haiti", "code": "HT"}, 
            {"name": "Heard Island and Mcdonald Islands", "code": "HM"}, 
            {"name": "Holy See (Vatican City State)", "code": "VA"}, 
            {"name": "Honduras", "code": "HN"}, 
            {"name": "Hong Kong", "code": "HK"}, 
            {"name": "Hungary", "code": "HU"}, 
            {"name": "Iceland", "code": "IS"}, 
            {"name": "India", "code": "IN"}, 
            {"name": "Indonesia", "code": "ID"}, 
            {"name": "Iran, Islamic Republic Of", "code": "IR"}, 
            {"name": "Iraq", "code": "IQ"}, 
            {"name": "Ireland", "code": "IE"}, 
            {"name": "Isle of Man", "code": "IM"}, 
            {"name": "Israel", "code": "IL"}, 
            {"name": "Italy", "code": "IT"}, 
            {"name": "Jamaica", "code": "JM"}, 
            {"name": "Japan", "code": "JP"}, 
            {"name": "Jersey", "code": "JE"}, 
            {"name": "Jordan", "code": "JO"}, 
            {"name": "Kazakhstan", "code": "KZ"}, 
            {"name": "Kenya", "code": "KE"}, 
            {"name": "Kiribati", "code": "KI"}, 
            {"name": "Korea, Democratic People\'S Republic of", "code": "KP"}, 
            {"name": "Korea, Republic of", "code": "KR"}, 
            {"name": "Kuwait", "code": "KW"}, 
            {"name": "Kyrgyzstan", "code": "KG"}, 
            {"name": "Lao People\'S Democratic Republic", "code": "LA"}, 
            {"name": "Latvia", "code": "LV"}, 
            {"name": "Lebanon", "code": "LB"}, 
            {"name": "Lesotho", "code": "LS"}, 
            {"name": "Liberia", "code": "LR"}, 
            {"name": "Libyan Arab Jamahiriya", "code": "LY"}, 
            {"name": "Liechtenstein", "code": "LI"}, 
            {"name": "Lithuania", "code": "LT"}, 
            {"name": "Luxembourg", "code": "LU"}, 
            {"name": "Macao", "code": "MO"}, 
            {"name": "Macedonia, The Former Yugoslav Republic of", "code": "MK"}, 
            {"name": "Madagascar", "code": "MG"}, 
            {"name": "Malawi", "code": "MW"}, 
            {"name": "Malaysia", "code": "MY"}, 
            {"name": "Maldives", "code": "MV"}, 
            {"name": "Mali", "code": "ML"}, 
            {"name": "Malta", "code": "MT"}, 
            {"name": "Marshall Islands", "code": "MH"}, 
            {"name": "Martinique", "code": "MQ"}, 
            {"name": "Mauritania", "code": "MR"}, 
            {"name": "Mauritius", "code": "MU"}, 
            {"name": "Mayotte", "code": "YT"}, 
            {"name": "Mexico", "code": "MX"}, 
            {"name": "Micronesia, Federated States of", "code": "FM"}, 
            {"name": "Moldova, Republic of", "code": "MD"}, 
            {"name": "Monaco", "code": "MC"}, 
            {"name": "Mongolia", "code": "MN"}, 
            {"name": "Montenegro", "code": "ME"},
            {"name": "Montserrat", "code": "MS"},
            {"name": "Morocco", "code": "MA"}, 
            {"name": "Mozambique", "code": "MZ"}, 
            {"name": "Myanmar", "code": "MM"}, 
            {"name": "Namibia", "code": "NA"}, 
            {"name": "Nauru", "code": "NR"}, 
            {"name": "Nepal", "code": "NP"}, 
            {"name": "Netherlands", "code": "NL"}, 
            {"name": "New Caledonia", "code": "NC"}, 
            {"name": "New Zealand", "code": "NZ"}, 
            {"name": "Nicaragua", "code": "NI"}, 
            {"name": "Niger", "code": "NE"}, 
            {"name": "Nigeria", "code": "NG"}, 
            {"name": "Niue", "code": "NU"}, 
            {"name": "Norfolk Island", "code": "NF"}, 
            {"name": "Northern Mariana Islands", "code": "MP"}, 
            {"name": "Norway", "code": "NO"}, 
            {"name": "Oman", "code": "OM"}, 
            {"name": "Pakistan", "code": "PK"}, 
            {"name": "Palau", "code": "PW"}, 
            {"name": "Palestinian Territory, Occupied", "code": "PS"}, 
            {"name": "Panama", "code": "PA"}, 
            {"name": "Papua New Guinea", "code": "PG"}, 
            {"name": "Paraguay", "code": "PY"}, 
            {"name": "Peru", "code": "PE"}, 
            {"name": "Philippines", "code": "PH"}, 
            {"name": "Pitcairn", "code": "PN"}, 
            {"name": "Poland", "code": "PL"}, 
            {"name": "Portugal", "code": "PT"}, 
            {"name": "Puerto Rico", "code": "PR"}, 
            {"name": "Qatar", "code": "QA"}, 
            {"name": "Reunion", "code": "RE"}, 
            {"name": "Romania", "code": "RO"}, 
            {"name": "Russian Federation", "code": "RU"}, 
            {"name": "RWANDA", "code": "RW"}, 
            {"name": "Saint Helena", "code": "SH"}, 
            {"name": "Saint Kitts and Nevis", "code": "KN"}, 
            {"name": "Saint Lucia", "code": "LC"}, 
            {"name": "Saint Pierre and Miquelon", "code": "PM"}, 
            {"name": "Saint Vincent and the Grenadines", "code": "VC"}, 
            {"name": "Samoa", "code": "WS"}, 
            {"name": "San Marino", "code": "SM"}, 
            {"name": "Sao Tome and Principe", "code": "ST"}, 
            {"name": "Saudi Arabia", "code": "SA"}, 
            {"name": "Senegal", "code": "SN"}, 
            {"name": "Serbia", "code": "RS"}, 
            {"name": "Seychelles", "code": "SC"}, 
            {"name": "Sierra Leone", "code": "SL"}, 
            {"name": "Singapore", "code": "SG"}, 
            {"name": "Slovakia", "code": "SK"}, 
            {"name": "Slovenia", "code": "SI"}, 
            {"name": "Solomon Islands", "code": "SB"}, 
            {"name": "Somalia", "code": "SO"}, 
            {"name": "South Africa", "code": "ZA"}, 
            {"name": "South Georgia and the South Sandwich Islands", "code": "GS"}, 
            {"name": "Spain", "code": "ES"}, 
            {"name": "Sri Lanka", "code": "LK"}, 
            {"name": "Sudan", "code": "SD"}, 
            {"name": "Suriname", "code": "SR"}, 
            {"name": "Svalbard and Jan Mayen", "code": "SJ"}, 
            {"name": "Swaziland", "code": "SZ"}, 
            {"name": "Sweden", "code": "SE"}, 
            {"name": "Switzerland", "code": "CH"}, 
            {"name": "Syrian Arab Republic", "code": "SY"}, 
            {"name": "Taiwan, Province of China", "code": "TW"}, 
            {"name": "Tajikistan", "code": "TJ"}, 
            {"name": "Tanzania, United Republic of", "code": "TZ"}, 
            {"name": "Thailand", "code": "TH"}, 
            {"name": "Timor-Leste", "code": "TL"}, 
            {"name": "Togo", "code": "TG"}, 
            {"name": "Tokelau", "code": "TK"}, 
            {"name": "Tonga", "code": "TO"}, 
            {"name": "Trinidad and Tobago", "code": "TT"}, 
            {"name": "Tunisia", "code": "TN"}, 
            {"name": "Turkey", "code": "TR"}, 
            {"name": "Turkmenistan", "code": "TM"}, 
            {"name": "Turks and Caicos Islands", "code": "TC"}, 
            {"name": "Tuvalu", "code": "TV"}, 
            {"name": "Uganda", "code": "UG"}, 
            {"name": "Ukraine", "code": "UA"}, 
            {"name": "United Arab Emirates", "code": "AE"}, 
            {"name": "United Kingdom", "code": "GB"}, 
            {"name": "United States", "code": "US"}, 
            {"name": "United States Minor Outlying Islands", "code": "UM"}, 
            {"name": "Uruguay", "code": "UY"}, 
            {"name": "Uzbekistan", "code": "UZ"}, 
            {"name": "Vanuatu", "code": "VU"}, 
            {"name": "Venezuela", "code": "VE"}, 
            {"name": "Viet Nam", "code": "VN"}, 
            {"name": "Virgin Islands, British", "code": "VG"}, 
            {"name": "Virgin Islands, U.S.", "code": "VI"}, 
            {"name": "Wallis and Futuna", "code": "WF"}, 
            {"name": "Western Sahara", "code": "EH"}, 
            {"name": "Yemen", "code": "YE"}, 
            {"name": "Zambia", "code": "ZM"}, 
            {"name": "Zimbabwe", "code": "ZW"} 
            ];
        var timeframes = [{name:'Unlimited', value:-1 }, 
                          {name:'1 year', value:12}, 
                          {name:'2 year', value:2*12}, 
                          {name:'3 year', value:3*12}, 
                          {name:'5 year', value:5*12}, 
                          {name:'10 year', value:10*12}];
        var purposes = [{name:'All purposes'}, {name:'Research'}, {name:'Commercial'}];
        var transferabilities = [{name:'Sublicensing right'},
                                 {name:'No sublicensing right'}];
        var standards = [{name:'Public Domain Dedication and License (PDDL)', summary: 'https://opendatacommons.org/licenses/pddl/summary/', legalText: 'https://opendatacommons.org/licenses/pddl/1.0/'},
                         {name:'Attribution License (ODC-BY)', summary: 'https://opendatacommons.org/licenses/by/summary/', legalText: 'https://opendatacommons.org/licenses/by/1.0/'},
                         {name:'Open Database License (ODC-ODbL)', summary: 'https://opendatacommons.org/licenses/odbl/summary/', legalText: 'https://opendatacommons.org/licenses/odbl/1.0/'},
                         {name:'Attribution 4.0 International (CC BY 4.0)', summary: 'https://creativecommons.org/licenses/by/4.0/', legalText: 'https://creativecommons.org/licenses/by/4.0/legalcode'},
                         {name:'Attribution-NoDerivatives International 4.0 (CC BY-ND 4.0)', summary: 'https://creativecommons.org/licenses/by-nd/4.0/', legalText: 'https://creativecommons.org/licenses/by-nd/4.0/legalcode'},
                         {name:'Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)', summary: 'https://creativecommons.org/licenses/by-sa/4.0/', legalText: 'https://creativecommons.org/licenses/by-sa/4.0/legalcode'},
                         {name:'Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)', summary: 'https://creativecommons.org/licenses/by-nc/4.0/', legalText: 'https://creativecommons.org/licenses/by-nc/4.0/legalcode'},
                         {name:'Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)', summary: 'https://creativecommons.org/licenses/by-nc-nd/4.0/', legalText: 'https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode'},
                         {name:'Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)', summary: 'https://creativecommons.org/licenses/by-nc-sa/4.0/', legalText: 'https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode'}];

        var TEMPLATES = {
            PRICE: {
                currencyCode: CURRENCY_CODES[0].value,
                dutyFreeAmount: 0,
                percentage: 0,
                taxIncludedAmount: 0,
                taxRate: TAX_RATE,
            },
            PRICE_ALTERATION: {
                description: '',
                isPercentage: true,
                name: TYPES.PRICE_ALTERATION.FEE.code,
                price: {},
                priceAlterationType: TYPES.PRICE_ALTERATION_SUPPORTED.PRICE_COMPONENT,
                priceCondition: 0,
                priceConditionOperator: TYPES.PRICE_CONDITION.GE.code,
                priceType: TYPES.PRICE.ONE_TIME,
                recurringChargePeriod: '',
                unitOfMeasure: ''
            },
            PRICE_PLAN: {
                description: '',
                name: '',
                price: {},
                priceType: TYPES.PRICE.ONE_TIME,
                recurringChargePeriod: '',
                unitOfMeasure: ''
            },
            TERMS: {
                type: 'None',
                isFullCustom: false,
                title: '',
                description: '',
                exclusivity: '',
                purpose: '',
                duration: {},
                sector: '',
                transferability: '',
                region: '',
                validFor: {
                    startDateTime: '',
                    endDateTime: ''
                }
            },
            LICENSE: {
                terms: {},
                licenseType: TYPES.LICENSE.NONE
            },
            SLA: {
                offerId: '',
                metrics: [] 
            },
            METRIC: {
                type: '' ,
                threshold: '',
                unitMeasure: '',
                description: ''
            },
            RESOURCE: {
                bundledProductOffering: [],
                category: [],
                description: '',
                isBundle: false,
                lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                name: '',
                place: [],
                productOfferingPrice: [],
                validFor: {},
                version: '0.1'
            }
        };

        const serializeAlteration = function(priceAlteration) {
            var result = '';

            switch (priceAlteration.priceAlterationType) {
            case TYPES.PRICE_ALTERATION_SUPPORTED.PRICE_CONDITION:
                result += '+ ' + PricePlan.prototype.toString.call(priceAlteration);
                break;
            case TYPES.PRICE_ALTERATION_SUPPORTED.DISCOUNT_OR_FEE:
                result += (priceAlteration.name === TYPES.PRICE_ALTERATION.FEE.code ? '+' : '-');
                result += '' + (priceAlteration.isPercentage ? priceAlteration.price.percentage + '%' : priceAlteration.price.taxIncludedAmount + ' ' + priceAlteration.price.currencyCode);
                break;
            }

            return result;
        }

        const builtAterationJSON = function(priceAlteration) {
            var data = {
                description: priceAlteration.description,
                name: priceAlteration.name,
                price: priceAlteration.price,
                priceType: priceAlteration.priceType,
                recurringChargePeriod: priceAlteration.recurringChargePeriod,
                unitOfMeasure: priceAlteration.unitOfMeasure
            };

            switch (priceAlteration.priceAlterationType) {
            case TYPES.PRICE_ALTERATION_SUPPORTED.PRICE_CONDITION:
                data.priceCondition = '';
                break;
            case TYPES.PRICE_ALTERATION_SUPPORTED.DISCOUNT_OR_FEE:
                data.priceCondition = priceAlteration.priceConditionOperator + ' ' + priceAlteration.priceCondition;
                break;
            }

            return data;
        }

        const formatCondition = function(priceAlteration) {
            return 'if ' + angular.lowercase(TYPES.PRICE_CONDITION[angular.uppercase(priceAlteration.priceConditionOperator)].name)
                + ' ' + priceAlteration.priceCondition + ' ' + priceAlteration.price.currencyCode;
        }

        const formatAlteration = function(priceAlteration, extended) {
            let result = '';

            if (typeof extended !== 'boolean') {
                extended = true;
            }

            if (priceAlteration.priceAlterationType === TYPES.PRICE_ALTERATION_SUPPORTED.DISCOUNT_OR_FEE) {
                result += ' ' + (extended ? formatCondition(priceAlteration) : '*');
            }

            return serializeAlteration(priceAlteration) + result;
        }

        const buildPriceJSON = function(price) {
            var data = {
                currencyCode: price.currencyCode,
                dutyFreeAmount: price.taxIncludedAmount / ((100 + price.taxRate) / 100),
                percentage: price.percentage,
                taxIncludedAmount: price.taxIncludedAmount,
                taxRate: price.taxRate
            };

            if (typeof price.arrayExcluded !== "undefined") {
                price.arrayExcluded.forEach(function (name) {
                    if (name in data) {
                        delete data[name];
                    }
                });
            }

            return data;
        }

        var Price = function Price(data, arrayExcluded) {
            angular.extend(this, angular.copy(TEMPLATES.PRICE), angular.copy(data));
            parseNumber(this, ['dutyFreeAmount', 'percentage', 'taxIncludedAmount', 'taxRate']);
            this.arrayExcluded = angular.isArray(arrayExcluded) ? arrayExcluded : [];
        };

        Price.prototype.toJSON = function toJSON() {
            return buildPriceJSON(this);
        };

        Price.prototype.toString = function toString() {
            let stringVal;
            if (this.taxIncludedAmount > 0) {
                stringVal = this.taxIncludedAmount + ' ' + this.currencyCode;
            } else {
                stringVal = "Free";
            }
            return stringVal;
        };

        var PriceAlteration = function PriceAlteration(data) {
            angular.extend(this, angular.copy(TEMPLATES.PRICE_ALTERATION), angular.copy(data));
            this.price = new Price(this.price, ['currencyCode']);
        };

        PriceAlteration.prototype.setIsPercentage = function setIsPercentage(value) {
            this.isPercentage = value;
            this.price.percentage = 0;
            this.price.taxIncludedAmount = 0;
        };

        PriceAlteration.prototype.setType = function setType(priceType) {
            return PricePlan.prototype.setType.call(this, priceType);
        };

        PriceAlteration.prototype.format = function format(extended) {
            return formatAlteration(this, extended);
        };

        PriceAlteration.prototype.formatPriceCondition = function formatPriceCondition() {
            return formatCondition(this);
        };

        PriceAlteration.prototype.toString = function toString() {
            return serializeAlteration(this);
        };

        PriceAlteration.prototype.toJSON = function toJSON() {
            return builtAterationJSON(this);
        };

        var PricePlan = function PricePlan(data) {
            angular.extend(this, angular.copy(TEMPLATES.PRICE_PLAN), angular.copy(data));
            this.price = new Price(this.price);

            if (angular.isObject(this.productOfferPriceAlteration)) {
                extendPriceAlteration(this, this.productOfferPriceAlteration);
                this.productOfferPriceAlteration = new PriceAlteration(this.productOfferPriceAlteration);
            } else {
                delete this.productOfferPriceAlteration;
            }
        };
        PricePlan.prototype.setCurrencyCode = function setCurrencyCode(currencyCode) {

            if (this.productOfferPriceAlteration) {
                this.productOfferPriceAlteration.price.currencyCode = currencyCode;
            }

            this.price.currencyCode = currencyCode;

            return this;
        };
        PricePlan.prototype.setType = function setType(priceType) {

            if (!angular.equals(this.priceType, priceType)) {
                this.priceType = TYPES.PRICE[priceType];
                this.unitOfMeasure = '';
                this.recurringChargePeriod = '';

                switch (this.priceType) {
                case TYPES.PRICE.RECURRING:
                    this.recurringChargePeriod = TYPES.CHARGE_PERIOD.WEEKLY;
                    break;
                }
            }

            return this;
        };
        PricePlan.prototype.toString = function toString() {
            var result = '';

            switch (this.priceType) {
            case TYPES.PRICE.RECURRING:
                result = ' / ' + this.recurringChargePeriod;
                break;
            case TYPES.PRICE.USAGE:
                result = ' / ' + this.unitOfMeasure;
                break;
            }

            return this.price + result;
        };

        PricePlan.prototype.toJSON = function toJSON() {
            let plan = angular.copy(this);

            if (angular.isObject(this.productOfferPriceAlteration)) {
                plan.productOfferPriceAlteration = builtAterationJSON(this.productOfferPriceAlteration);
                plan.productOfferPriceAlteration.price = buildPriceJSON(this.productOfferPriceAlteration.price)
            }
            return plan;
        };

        PricePlan.prototype.formatPriceAlteration = function formatPriceAlteration(extended) {
            return this.productOfferPriceAlteration ? formatAlteration(this.productOfferPriceAlteration, extended) : '';
        };

        PricePlan.prototype.resetPriceAlteration = function resetPriceAlteration(priceAlterationType) {

            switch (priceAlterationType) {
                case TYPES.PRICE_ALTERATION_SUPPORTED.PRICE_COMPONENT:
                case TYPES.PRICE_ALTERATION_SUPPORTED.DISCOUNT_OR_FEE:
                    this.productOfferPriceAlteration = new PriceAlteration({
                        priceAlterationType: priceAlterationType,
                        price: {
                            currencyCode: this.price.currencyCode
                        }
                    });
                    break;
                default:
                    delete this.productOfferPriceAlteration;
            }
            return this;
        };

        PricePlan.prototype.priceAlteration = function priceAlteration() {
            return this.productOfferPriceAlteration;
        };

        PricePlan.prototype.formatCurrencyCode = function formatCurrencyCode() {
            return '(' + this.price.currencyCode + ') ' + TYPES.CURRENCY_CODE[this.price.currencyCode];
        };

        var Terms = function Terms(data) {
            angular.extend(this, TEMPLATES.TERMS, data);
        };

        var License = function License(data) {
            angular.extend(this, TEMPLATES.LICENSE, data);
            this.terms = new Terms(this.terms);
        };
        License.prototype.setType = function setType(typeName) {
            if (typeName in TYPES.LICENSE && !angular.equals(this.licenseType, typeName)) {
                this.licenseType = TYPES.LICENSE[typeName];
                this.clearTerms();
            }

            switch (this.licenseType) {
                case TYPES.LICENSE.NONE:{
                    this.terms.type = 'None';
                    this.terms.isFullCustom = false;
                    break;
                }
                case TYPES.LICENSE.STANDARD:{
                    this.terms.type = 'Standard';
                    this.terms.isFullCustom = false;
                    break;
                }
                case TYPES.LICENSE.WIZARD:{
                    this.terms.type = 'Custom';
                    this.terms.isFullCustom = false;
                    break;
                }
                case TYPES.LICENSE.FREETEXT:{
                    this.terms.type = 'Custom';
                    this.terms.isFullCustom = true;
                    break;
                }
            }

            return this;
        };

        License.prototype.setStandard = function setStandard(standard_t) {

            if (!angular.equals(this.terms.title, standard_t.name)) {
                this.terms.title = standard_t.name;
                //this.terms.description = "Summary: " + standard_t.summary + "\nLegal Text: " + standard_t.legalText;
                this.terms.description = standard_t.summary;    
            }

            return this;
        };

        License.prototype.setDuration = function setDuration(duration_t) {

            this.terms.duration.name = duration_t.name;
            this.terms.duration.value = duration_t.value;
            if (this.terms.duration.value > 0){
                var now = new Date();
                this.terms.validFor.startDateTime = now.toISOString();
                var endTime = new Date(now);
                endTime.setMonth(endTime.getMonth() + this.terms.duration.value);
                this.terms.validFor.endDateTime = endTime.toISOString();
            }
            else {
                this.terms.validFor = {};
            }

            return this;
        };

        License.prototype.clearTerms = function clearTerms() {
            
            //this.terms.type = 'None';
            //this.terms.isFullCustom = false;
            this.terms.title = '';
            this.terms.description = '';
            this.terms.exclusivity = '';
            this.terms.purpose = '';
            this.terms.duration = {};
            this.terms.sector = '';
            this.terms.transferability = '';
            this.terms.region = '';
            this.terms.validFor = {};

            return this;
        };

        License.prototype.toJSON = function toJSON() {
            return {
                name : this.terms.title,
                description : this.terms.description,
                type : this.terms.type,
                isFullCustom : this.terms.isFullCustom,
                exclusivity : this.terms.exclusivity,
                sector : this.terms.sector,
                region : this.terms.region,
                purpose : this.terms.purpose,
                duration : this.terms.duration.value,
                transferability : this.terms.transferability,
                validFor : this.terms.validFor
            };
        };

        var Metric = function Metric(data) {
            angular.extend(this, TEMPLATES.METRIC, data);
        };
        
        var Sla = function Sla(data) {
            angular.extend(this, TEMPLATES.SLA, data);
        };

        Metric.prototype.setType = function setType(typeName) {

            if (typeName in TYPES.METRICS && !angular.equals(this.type, typeName)) {
                this.type = TYPES.METRICS[typeName];
                this.clearMetric();
            }
            
            switch (this.type) {
                case TYPES.METRICS.UPDATES:{
                    this.unitMeasure = TYPES.TIMERANGE.DAY;
                    this.description = TYPES.MEASURESDESC.UPDATES;
                    break;
                }
                case TYPES.METRICS.RESPTIME:{
                    this.unitMeasure = TYPES.UNITS.MSEC;
                    this.description = TYPES.MEASURESDESC.RESPTIME;
                    break;
                }
                case TYPES.METRICS.DELAY:{
                    this.unitMeasure = TYPES.UNITS.MSEC;
                    this.description = TYPES.MEASURESDESC.DELAY;
                    break;
                }
            }

            return this;
        };

        Metric.prototype.setUnit = function setUnit(unit) {

            if (unit in TYPES.TIMERANGE && !angular.equals(this.unitMeasure, unit)) {
                this.unitMeasure = TYPES.TIMERANGE[unit];
                //this.clearMetric();
            }
            if (unit in TYPES.UNITS && !angular.equals(this.unitMeasure, unit)) {
                this.unitMeasure = TYPES.UNITS[unit];
                //this.clearMetric();
            }
            
            // switch (this.type) {
            //     case TYPES.METRICS.UPDATES:{
            //         this.type = '';
            //         break;
            //     }
            //     case TYPES.METRICS.B:{
            //         this.type = 'B';
            //         break;
            //     }
            //     case TYPES.METRICS.C:{
            //         this.type = 'C';
            //         break;
            //     }
            // }

            return this;
        };

        Metric.prototype.clearMetric = function clearMetric() {
            //this.type = '';
            this.threshold = '';
            this.unitMeasure = '';
            this.description = '';
            return this;
        };


        Sla.prototype.clearSla = function clearSla() {
            
            //this.sla.type = 'None';
            //this.sla.offerID = '';
            this.metrics = [];
            return this;
        };

        Sla.prototype.toJSON = function toJSON() {
            return {
                offerId : this.offerId,
                services : JSON.parse(JSON.stringify(this.metrics))
            };
        };

        return {
            EVENTS: EVENTS,
            TEMPLATES: TEMPLATES,
            TYPES: TYPES,
            PATCHABLE_ATTRS: PATCHABLE_ATTRS,
            PricePlan: PricePlan,
            PriceAlteration: PriceAlteration,
            License: License,
            Sla: Sla,
            Metric: Metric,
            search: search,
            count: count,
            exists: exists,
            create: create,
            setSla: setSla,
            getSla: getSla,
            getReputation: getReputation,
            getOverallReputation: getOverallReputation,
            detail: detail,
            update: update,
            exclusivities: exclusivities,
            sectors: sectors,
            regions: regions,
            timeframes: timeframes,
            purposes: purposes,
            transferabilities: transferabilities,
            standards: standards
        };

        function query(deferred, filters, method, callback) {
            var params = {};

            if (!angular.isObject(filters)) {
                filters = {};
            }

            if (filters.catalogueId) {
                params.catalogue = 'catalog';
                params.catalogueId = filters.catalogueId;
            }

            if (filters.id) {
                params['id'] = filters.id;
            }

            if (filters.status) {
                params['lifecycleStatus'] = filters.status;
            }

            if (filters.type  !== undefined) {
                params['isBundle'] = filters.type == 'Bundle';
            }

            if (filters.categoryId) {
                params['category.id'] = filters.categoryId;
            }

            if (filters.action) {
                params['action'] = filters.action;
            }

            if (filters.owner) {
                params['relatedParty'] = User.loggedUser.currentUser.id;
            } else {
                params['lifecycleStatus'] = LIFECYCLE_STATUS.LAUNCHED;
            }

            if (filters.sort) {
                params['sort'] = filters.sort;
            }

            if (filters.offset !== undefined) {
                params['offset'] = filters.offset;
                params['size'] = filters.size;
            }

            if (filters.body !== undefined) {
                params['body'] = filters.body.replace(/\s/g, ',');
            }

            if (filters.productSpecId !== undefined) {
                params['productSpecification.id'] = filters.productSpecId;
            }

            method(params, function (offeringList) {
                callback(offeringList);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function search(filters) {
            var deferred = $q.defer();

            function searchOfferingProducts(productFilters, offeringList) {
                ProductSpec.search(productFilters).then(function (productList) {
                    offeringList.forEach(function(offering) {
                        productList.some(function(product) {
                            if (offering.productSpecification && offering.productSpecification.id == product.id) {
                                offering.productSpecification = product;
                                return true;
                            }
                        });
                    });
                    deferred.resolve(offeringList);
                });
            }

            return query(deferred, filters, resource.query, function(offeringList) {
                if (offeringList.length) {
                    var bundleOfferings = [];
                    var productFilters = {
                        id: offeringList.map(function (offering) {
                            var offId = '';
                            extendPricePlans(offering);

                            if (!offering.isBundle) {
                                offId = offering.productSpecification.id;
                            } else {
                                bundleOfferings.push(offering);
                            }
                            return offId;
                        }).join()
                    };

                    if (!bundleOfferings.length) {
                        searchOfferingProducts(productFilters, offeringList);
                    } else {
                        var processed = 0;
                        bundleOfferings.forEach(function(offering) {
                            attachOfferingBundleProducts(offering, function(res) {
                                processed += 1;

                                if (res) {
                                    deferred.reject(res);
                                } else if (processed == bundleOfferings.length) {
                                    searchOfferingProducts(productFilters, offeringList);
                                }
                            });
                        });
                    }

                } else {
                    deferred.resolve(offeringList);
                }
            });
        }

        function count(filters) {
            var deferred = $q.defer();
            filters.action = 'count';

            return query(deferred, filters, resource.get, function (countRes) {
                deferred.resolve(countRes);
            });
        }

        function exists(params) {
            var deferred = $q.defer();

            resource.query(params, function (offeringList) {
                deferred.resolve(!!offeringList.length);
            });

            return deferred.promise;
        }

//{
//    "bundledProductOffering": [],
//    "category": [],
//    "description": "Description",
//    "isBundle": false,
//    "lifecycleStatus": "Active",
//    "name": "Name",
//    "place": [{
//        "name": "Place"
//    }],
//    "productOfferingPrice": [],
//    "validFor": {
//        "startDateTime": "2018-03-09T15:23:21+00:00"
//    },
//    "version": "0.1",
//    "serviceCandidate": {
//        "id": "defaultRevenue",
//        "name": "Revenue Sharing Service"
//    },
//    "productOfferingTerm": [{
//        "name": "My custom license",
//        "description": "description",
//        "type": "Custom",
//        "isFullCustom": false,
//        "exclusivity": "Exclusive",
//        "sector": "All sectors",
//        "region": "All regions",
//        "purpose": "All purposes",
//        "duration": "12",
//        "transferability": "Sublicensing right",
//        "validFor": {
//                "startDateTime": "2018-04-19T16:42:23-04:00",
//                "endDateTime": "2019-04-18T16:42:23-04:00"
//        }
//    }],
//    "productSpecification": {
//        "id": "1",
//        "href": "http://127.0.0.1:8000/DSProductCatalog/api/catalogManagement/v2/productSpecification/4:(0.1)"
//    }
//}
        function create(data, product, catalogue, terms) {
            var deferred = $q.defer();
            var params = {
                catalogue: 'catalog',
                catalogueId: catalogue.id
            };
            var bundledProductOffering = data.bundledProductOffering;

            angular.extend(data, {
                category: data.category.map(function (category) {
                    return category.serialize();
                }),
                bundledProductOffering: data.bundledProductOffering.map(function (offering) {
                    return offering.serialize();
                })
            });

            if(!data.isBundle) {
                angular.extend(data, {
                    productSpecification: product.serialize()
                });
                
            }

            
            angular.extend(data, {
                productOfferingTerm: terms
            });

            data.validFor = {
                startDateTime: moment().format()
            };

            resource.save(params, data, function (offeringCreated) {
                offeringCreated.productSpecification = product;
                offeringCreated.bundledProductOffering = bundledProductOffering;
                deferred.resolve(offeringCreated);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function setSla(sla) {
            var deferred = $q.defer();
            var slaResource = $resource(URLS.SLA_SET);
            slaResource.save(sla, function (slaCreated) {
                //slaCreated.id = _id;
                //slaCreated.offeringId = offerId;
                deferred.resolve(slaCreated);
            }, function (response) {
                deferred.reject(response);
            });
            return deferred.promise;
        }

        function getSla(id) {
            var deferred = $q.defer();
            var params = {
                id: id
            };
            var sla = {};
            var slaResource = $resource(URLS.SLA_GET);
            slaResource.get(params, function (collection) {
                sla = collection;
                sla.metrics = sla.services;
                deferred.resolve(sla);
            }, function (response) {
                deferred.reject(response);
            });
            return deferred.promise;
        }

        function getReputation(id, consumerId) {
            var deferred = $q.defer();
            var params = {
                id: id,
                consumerId: consumerId
            };
            var reputationResource = $resource(URLS.REPUTATION_GET);
            reputationResource.get(params, function (reputation) {
                deferred.resolve(reputation);
            }, function (response) {
                deferred.reject(response);
            });
            return deferred.promise;
        }
        
        function getOverallReputation() {
            var deferred = $q.defer();
            var params = {};
            var reputationResource = $resource(URLS.REPUTATION_GET_ALL);
            reputationResource.query(params, function (reputationList) {
                deferred.resolve(reputationList);
            }, function (response) {
                deferred.reject(response);
            });
            return deferred.promise;
        }

        function parseNumber(context, names) {
            names.forEach(function (name) {
                if (angular.isString(context[name])) {
                    context[name] = Number(context[name]);
                }
            });
        }

        function attachOfferingBundleProducts(offering, callback) {
            if (!angular.isArray(offering.bundledProductOffering)) {
                offering.bundledProductOffering = [];
            }

            var params = {
                id: offering.bundledProductOffering.map(function (data) {
                    return data.id;
                }).join()
            };

            resource.query(params, function (offeringList) {
                offering.bundledProductOffering = offeringList;
                var bundleIndexes = {};
                var productParams = {
                    id: offeringList.map(function (data, index) {
                        extendPricePlans(data);
                        bundleIndexes[data.productSpecification.id] = index;
                        return data.productSpecification.id
                    }).join()
                };

                ProductSpec.search(productParams).then(function (productList) {
                    // Include product spec info in bundled offering
                    productList.forEach(function (product) {
                        offering.bundledProductOffering[bundleIndexes[product.id]].productSpecification = product;
                    });
                    callback();
                }, function (response) {
                    callback(response);
                });
            }, function (response) {
                callback(response);
            });
        }

        function detail(id) {
            var deferred = $q.defer();
            var params = {
                id: id
            };

            resource.query(params, function (collection) {

                if (collection.length) {
                    var productOffering = collection[0];

                    extendPricePlans(productOffering);
                    if (productOffering.productSpecification) {
                        ProductSpec.detail(productOffering.productSpecification.id).then(function (productRetrieved) {
                            productOffering.productSpecification = productRetrieved;
                            detailRelationship(productOffering);
                        });
                    } else {
                        extendBundledProductOffering(productOffering);
                    }
                } else {
                    deferred.reject(404);
                }
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;

            function detailRelationship(productOffering) {
                if (productOffering.productSpecification.productSpecificationRelationship.length) {
                    var params = {
                        'productSpecification.id': productOffering.productSpecification.productSpecificationRelationship.map(function (relationship) {
                            relationship.productOffering = [];
                            return relationship.productSpec.id;
                        }).join()
                    };

                    resource.query(params, function (collection) {
                        if (collection.length) {
                            collection.forEach(function (productOfferingRelated) {
                                extendPricePlans(productOfferingRelated);
                                productOffering.productSpecification.productSpecificationRelationship.forEach(function (relationship) {
                                    if (productOfferingRelated.productSpecification.id === relationship.productSpec.id) {
                                        productOfferingRelated.productSpecification = relationship.productSpec;
                                        relationship.productOffering.push(productOfferingRelated);
                                    }
                                });
                            });
                        }
                        extendCategory(productOffering);
                    }, function (response) {
                        deferred.reject(response);
                    });
                } else {
                    extendCategory(productOffering);
                }
            }

            function extendBundledProductOffering(offering) {

                if (offering.isBundle) {
                    attachOfferingBundleProducts(offering, function(res) {
                        if (res) {
                            deferred.reject(res);
                        } else {
                            extendCategory(offering);
                        }
                    });
                } else {
                    extendCategory(offering);
                }
            }

            function extendCategory(offering) {
                var categories = 0;

                if (!angular.isArray(offering.category)) {
                    offering.category = [];
                }

                if (offering.category.length) {
                    offering.category.forEach(function (data, index) {
                        Category.detail(data.id, false).then(function (categoryRetrieved) {
                            offering.category[index] = categoryRetrieved;
                            categories++;

                            if (categories === offering.category.length) {
                                deferred.resolve(offering);
                            }
                        });
                    });
                } else {
                    deferred.resolve(offering);
                }
            }
        }

        function extendPricePlans(productOffering) {
            if (!angular.isArray(productOffering.productOfferingPrice)) {
                productOffering.productOfferingPrice = [];
            } else {
                productOffering.productOfferingPrice = productOffering.productOfferingPrice.map(function (pricePlan) {
                    return new PricePlan(pricePlan);
                });
            }
        }

        function update(offering, data) {
            var deferred = $q.defer();
            var params = {
                catalogue: 'catalog',
                catalogueId: getCatalogueId(offering),
                offeringId: offering.id
            };

            resource.update(params, data, function (offeringUpdated) {
                deferred.resolve(offeringUpdated);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function getCatalogueId(offering) {
            var keys = offering.href.split('/');
            return keys[keys.indexOf('catalog') + 1];
        }

        function serialize() {
            /* jshint validthis: true */
            return {
                id: this.id,
                href: this.href
            };
        }

        function getCategories() {
            /* jshint validthis: true */
            var ids = this.category.filter(hasParentId).map(getParentId);

            return this.category.filter(function (category) {
                return ids.indexOf(category.id) === -1;
            });

            function hasParentId(category) {
                return !category.isRoot;
            }

            function getParentId(category) {
                return category.parentId;
            }
        }

        function getPicture() {
            /* jshint validthis: true */
            var picture = null;
            if (this.productSpecification) {
                picture = this.productSpecification.getPicture();
            } else {
                // The offering is a bundle, get a random image from its bundled offerings
                var imageIndex = Math.floor(Math.random() * (this.bundledProductOffering.length));
                picture = this.bundledProductOffering[imageIndex].productSpecification.getPicture();
            }
            return picture;
        }

        function formatCheapestPricePlan(extended) {
            /* jshint validthis: true */
            var result = "", pricePlan = null, pricePlans = [];

            if (this.productOfferingPrice.length) {
                pricePlans = this.productOfferingPrice.filter(function (pricePlan) {
                    return angular.lowercase(pricePlan.priceType) === TYPES.PRICE.ONE_TIME;
                });

                if (pricePlans.length) {
                    for (var i = 0; i < pricePlans.length; i++) {
                        if (pricePlan == null || Number(pricePlan.price.taxIncludedAmount) > Number(pricePlans[i].price.taxIncludedAmount)) {
                            pricePlan = this.productOfferingPrice[i];
                        }
                    }
                    result = 'From ' + pricePlan.toString() + '\n' + pricePlan.formatPriceAlteration(extended);
                } else {
                    pricePlans = this.productOfferingPrice.filter(function (pricePlan) {
                        return [TYPES.PRICE.RECURRING, TYPES.PRICE.USAGE].indexOf(angular.lowercase(pricePlan.priceType)) !== -1;
                    });
                    result = 'From ' + pricePlans[0].toString() + '\n' + pricePlans[0].formatPriceAlteration(extended);
                }
            } else {
                result = 'Free';
            }

            return result;
        }

        function appendPricePlan(pricePlan) {
            /* jshint validthis: true */
            var deferred = $q.defer();
            var dataUpdated = {
                productOfferingPrice: this.productOfferingPrice.concat(pricePlan)
            };

            update(this, dataUpdated).then(function () {
                this.productOfferingPrice.push(pricePlan);
                deferred.resolve(this);
            }.bind(this), function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function updatePricePlan(index, pricePlan) {
            /* jshint validthis: true */
            var deferred = $q.defer();
            var dataUpdated = {
                productOfferingPrice: this.productOfferingPrice.slice(0)
            };

            dataUpdated.productOfferingPrice[index] = pricePlan;

            update(this, dataUpdated).then(function () {
                angular.merge(this.productOfferingPrice[index], pricePlan);
                deferred.resolve(this);
            }.bind(this), function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function removePricePlan(index) {
            /* jshint validthis: true */
            var deferred = $q.defer();
            var dataUpdated = {
                productOfferingPrice: this.productOfferingPrice.slice(0)
            };

            dataUpdated.productOfferingPrice.splice(index, 1);

            update(this, dataUpdated).then(function () {
                this.productOfferingPrice.splice(index, 1);
                deferred.resolve(this);
            }.bind(this), function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function relationshipOf(productOffering) {
            /* jshint validthis: true */
            var i, relationship;

            for (var i = 0; i < this.productSpecification.productSpecificationRelationship.length; i++) {
                relationship = this.productSpecification.productSpecificationRelationship[i];
                if (relationship.productOffering.indexOf(productOffering) !== -1) {
                    return relationship;
                }
            }

            return null;
        }

        function relationships() {
            /* jshint validthis: true */
            var results = [];

            this.productSpecification.productSpecificationRelationship.forEach(function (relationship) {
                results = results.concat(relationship.productOffering);
            });

            return results;
        }

        function extendPriceAlteration(pricePlan, priceAlteration) {

            if (angular.isString(priceAlteration.priceCondition) && priceAlteration.priceCondition.length) {
                var priceCondition = getPriceCondition(priceAlteration);
                priceAlteration.priceCondition = priceCondition.value;
                priceAlteration.priceConditionOperator = priceCondition.operator;
                priceAlteration.isPercentage = !!priceAlteration.price.percentage;
                priceAlteration.priceAlterationType = TYPES.PRICE_ALTERATION_SUPPORTED.DISCOUNT_OR_FEE;
            } else {
                priceAlteration.priceAlterationType = TYPES.PRICE_ALTERATION_SUPPORTED.PRICE_COMPONENT;
            }

            priceAlteration.price.currencyCode = pricePlan.price.currencyCode;

            return priceAlteration;
        }

        function getPriceCondition(priceAlteration) {
            return {
                operator: priceAlteration.priceCondition.split(" ")[0],
                value: Number(priceAlteration.priceCondition.split(" ")[1])
            };
        }
    }

})();
