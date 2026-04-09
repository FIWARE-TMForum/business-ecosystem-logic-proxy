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

const proxyquire = require('proxyquire');
const testUtils = require('../utils');

describe('TMF Utils', function() {
    const config = testUtils.getDefaultConfig();

    const getTmfUtils = function(utils) {
        return proxyquire('../../lib/tmfUtils', {
            './../config': config,
            './utils': utils || {}
        });
    };

    const getPartyHref = function(protocol, hostname, userName) {
        return (
            protocol +
            '://' +
            hostname +
            ':' +
            config.port +
            '/' +
            config.tmforum.party.path +
            '/individual/' +
            userName
        );
    };

    describe('Is Owner', function() {
        const testIsOwner = function(req, info, expected) {
            var tmfUtils = getTmfUtils();

            var result = tmfUtils.isOwner(req, info);
            expect(result).toBe(expected);
        };

        it('should return true when the user is owner of the given resource', function() {
            const userName = 'test';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    roles: [],
                    partyId: userName
                }
            };

            const info = {
                relatedParty: [
                    {
                        role: 'Seller',
                        id: userName,
                        href: getPartyHref('http', req.hostname, userName)
                    }
                ]
            };

            testIsOwner(req, info, true);
        });

        it('should return false when the user is not owner of the resource', function() {
            const userName = 'user';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    roles: [],
                    partyId: 'another_user'
                }
            };

            const info = {
                relatedParty: [
                    {
                        role: 'Seller',
                        id: userName,
                        href: getPartyHref('http', req.hostname, userName)
                    }
                ]
            };

            testIsOwner(req, info, false);
        });

        it('should return false when the resource does not contain related party field', function() {
            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    roles: [],
                    partyId: 'test'
                }
            };

            const info = {};
            testIsOwner(req, info, false);
        });
    });

    describe('Filter Related Party Fields', function() {
        const testFilterRelatedPartyFields = function(user, query, expectedErr, newQueryParams, done) {
            const buildQueryString = function(query) {
                const queryArray = [];

                for (let key in query) {
                    queryArray.push(key + '=' + query[key]);
                }

                return queryArray.join('&');
            };

            let originalApiUrl = '/example/api/path';
            const queryIncluded = query && Object.keys(query).length > 0;

            if (queryIncluded) {
                originalApiUrl += '?' + buildQueryString(query);
            }

            const tmfUtils = getTmfUtils();
            const req = {
                apiUrl: originalApiUrl,
                query: query,
                user: user
            };

            tmfUtils.filterRelatedPartyFields(req, function(err) {
                expect(err).toEqual(expectedErr);

                if (!err) {
                    const newQueryParamsExpected = newQueryParams && Object.keys(newQueryParams).length > 0;
                    let expectedApiUrl = originalApiUrl;

                    if (newQueryParamsExpected) {
                        const separator = queryIncluded ? '&' : '?';
                        expectedApiUrl = originalApiUrl + separator + buildQueryString(newQueryParams);
                    }

                    expect(req.apiUrl).toBe(expectedApiUrl);
                }

                done();
            });
        };

        it('should call callback with error when Related Party field includes href', function(done) {
            const user = {
                partyId: 'fiware'
            };

            const query = {
                'relatedParty.href': 'http://fiware.org/user/fiware'
            };

            const err = {
                status: 403,
                message: 'You are not allowed to filter items using these filters'
            };

            testFilterRelatedPartyFields(user, query, err, null, done);
        });

        it('should call callback with error when Related Party field includes role', function(done) {
            const user = {
                partyId: 'fiware'
            };

            const query = {
                'relatedParty.role': 'Customer'
            };

            const err = {
                status: 403,
                message: 'You are not allowed to filter items using these filters'
            };

            testFilterRelatedPartyFields(user, query, err, null, done);
        });

        it('should call callback with error when asking for items from another user', function(done) {
            const user = {
                partyId: 'fiware'
            };

            const query = {
                'relatedParty.id': user.partyId + 'a'
            };

            const err = {
                status: 403,
                message: 'You are not authorized to retrieve the entities made by the user ' + query['relatedParty.id']
            };

            testFilterRelatedPartyFields(user, query, err, null, done);
        });

        it('should call callback without error when asking for their own items', function(done) {
            const user = {
                partyId: 'fiware'
            };

            const query = {
                'relatedParty.id': user.partyId
            };

            testFilterRelatedPartyFields(user, query, null, null, done);
        });

        it('should include party id when not included in the original request', function(done) {
            const user = {
                partyId: 'fiware'
            };

            const newQueryParams = {
                'relatedParty.id': user.partyId
            };

            testFilterRelatedPartyFields(user, {}, null, newQueryParams, done);
        });

        it('should include party id when not included in the original request and extra query params', function(done) {
            const user = {
                partyId: 'fiware'
            };

            const query = {
                state: 'failed'
            };

            const newQueryParams = {
                'relatedParty.id': user.partyId
            };

            testFilterRelatedPartyFields(user, query, null, newQueryParams, done);
        });
    });

    describe('Ensure Related Party Field', function() {
        const testEnsureRelatedParty = function(originalApiUrl, query, expectedApiUrl) {
            const req = {
                apiUrl: originalApiUrl,
                query: query
            };

            const tmfUtils = getTmfUtils();
            const callback = jasmine.createSpy();

            tmfUtils.ensureRelatedPartyIncluded(req, callback);

            expect(callback).toHaveBeenCalledWith(null);
            expect(req.apiUrl).toBe(expectedApiUrl);
        };

        const urlNotModified = function(originalApiUrl, query) {
            testEnsureRelatedParty(originalApiUrl, query, originalApiUrl);
        };

        const urlNotModifiedFields = function(fields) {
            urlNotModified('/product?fields=' + fields, { fields: fields });
        };

        it('should not modify the API URL when query is not included', function() {
            urlNotModified('/product', {});
        });

        it('should not modify the API URL when query included but fields is not included', function() {
            const name = 'fiware';
            urlNotModified('/product?name=' + name, { name: name });
        });

        it('should not modify the API URL when fields include related party at the beginning', function() {
            const fields = 'relatedParty,name';
            urlNotModifiedFields(fields);
        });

        it('should not modify the API URL when fields include related party at the end', function() {
            const fields = 'relatedParty,name';
            urlNotModifiedFields(fields);
        });

        it('should not modify the API URL when fields include related party in the middle', function() {
            const fields = 'name,relatedParty,version';
            urlNotModifiedFields(fields);
        });

        it(
            'should modify the API URL when related party is not included in the fields query param ' +
                'and there are no more query params',
            function() {
                const fields = 'name';
                const originalApiUrl = '/product?fields=' + fields;
                const expectedApiUrl = originalApiUrl + ',relatedParty';

                testEnsureRelatedParty(originalApiUrl, { fields: fields }, expectedApiUrl);
            }
        );

        it(
            'should modify the API URL when related party is not included in the fields query param ' +
                'and there are more query params',
            function() {
                const version = '1';
                const fields = 'name';

                const urlPattern = '/product?fields=FIELDS&version=' + version;
                const originalApiUrl = urlPattern.replace('FIELDS', fields);
                const expectedApiUrl = urlPattern.replace('FIELDS', fields + ',relatedParty');

                testEnsureRelatedParty(originalApiUrl, { fields: fields, version: version }, expectedApiUrl);
            }
        );
    });

    describe('Has Party Role', function() {
        it('should return false when related Party is empty', function() {
            const tmfUtils = getTmfUtils();
            const result = tmfUtils.hasPartyRole(
                { hostname: 'belp.fiware.org', secure: false, user: { partyId: 'fiware' } },
                [],
                'seller'
            );
            expect(result).toBe(false);
        });

        it('should return true when related Party contains one element and user and role matches', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName
                }
            };

            const relatedParties = [
                {
                    role: role,
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(true);
        });

        it('should return true when related Party contains one element and user and role (ignore case) matches', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName
                }
            };

            const relatedParties = [
                {
                    role: role.toUpperCase(),
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role.toLowerCase());
            expect(result).toBe(true);
        });

        it('should return false when related Party contains one element and user matches but role does not', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName
                }
            };

            const relatedParties = [
                {
                    role: role,
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role + 'a');
            expect(result).toBe(false);
        });

        it('should return false when related Party contains one element and role matches but user does not', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName + 'a'
                }
            };

            const relatedParties = [
                {
                    role: role,
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(false);
        });

        it('should return true when related Party contains two element and one matches', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName
                }
            };

            const relatedParties = [
                {
                    role: role,
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                },
                {
                    role: role + 'a',
                    id: userName + 'a',
                    href: getPartyHref('http', req.hostname, userName + 'a')
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(true);
        });

        it('should return false when related Party contains two element and none matches', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName
                }
            };

            const relatedParties = [
                {
                    role: role + 'b',
                    id: userName + 'b',
                    href: getPartyHref('http', req.hostname, userName + 'b')
                },
                {
                    role: role + 'a',
                    id: userName + 'a',
                    href: getPartyHref('http', req.hostname, userName + 'a')
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(false);
        });

        it('should return false when party has missing role property without crashing', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName
                }
            };

            const relatedParties = [
                {
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                    // missing role property
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(false);
        });

        it('should return false when party has missing id property without crashing', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName
                }
            };

            const relatedParties = [
                {
                    role: role,
                    href: getPartyHref('http', req.hostname, userName)
                    // missing id property
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(false);
        });

        it('should return false when party has null role without crashing', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName
                }
            };

            const relatedParties = [
                {
                    role: null,
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(false);
        });
    });

    describe('Get Party Individuals Collection URL', function() {
        const testGetIndividualsCollectionURL = function(req, user) {
            const utils = jasmine.createSpyObj('utils', ['getAPIURL']);

            const tmfUtils = getTmfUtils(utils);
            tmfUtils.getIndividualURL(req);

            let expectedPath = '/' + config.tmforum.party.path + '/individual/';

            if (user) {
                expectedPath += user;
            }

            expect(utils.getAPIURL).toHaveBeenCalledWith(req.secure, req.hostname, config.port, expectedPath);
        };

        it('should call utils with http', function() {
            const req = {
                secure: false,
                hostname: 'belp.fiware.org'
            };

            testGetIndividualsCollectionURL(req);
        });

        it('should call utils with https', function() {
            config.proxy.secured = true;
            const req = {
                secure: true,
                hostname: 'belp.fiware.org'
            };

            testGetIndividualsCollectionURL(req);
        });

        it('should call utils with http and without proxy', function() {
            config.proxy.enabled = false;

            const req = {
                secure: false,
                hostname: 'anotherHost.com'
            };

            testGetIndividualsCollectionURL(req);
        });

        it('should call utils with https and without proxy', function() {
            config.proxy.enabled = false;

            const req = {
                secure: true,
                hostname: 'anotherHost.com'
            };

            testGetIndividualsCollectionURL(req);
        });
    });

    describe('Method: haveSameStatus', function() {

        it('should return true if all elements inside the array have the specified status', function(){
            const tmfUtils = getTmfUtils();
            const array=[]
            for(let i=0; i<5; i++){
                array.push({name: `n${i}`, lifecycleStatus: 'Launched'})
            }
            expect(array.length).toBe(5)
            result = tmfUtils.haveSameStatus('launched', array)
            expect(result).toBe(true)
        })

        it('should return false if all elements inside the array have different status', function(){
            const tmfUtils = getTmfUtils();
            const array=[]
            for(let i=0; i<5; i++){
                array.push({name: `n${i}`, lifecycleStatus: 'Launched'})
            }
            array.push({name: 'error', lifecycleStatus: 'Launche'})
            expect(array.length).toBe(6)
            result = tmfUtils.haveSameStatus('launched', array)
            expect(result).toBe(false)
        })

    })

    describe('Method: refsToQuery', function(){
        it('should parse an array of refs to query structure string', function(){
            const tmfUtils = getTmfUtils();
            const array=[]
            for(let i=0; i<5; i++){
                array.push({id: `n${i}`, lifecycleStatus: 'Launched'})
            }
            expect(array.length).toBe(5)
            result = tmfUtils.refsToQuery(array)
            expect(result).toBe('n0,n1,n2,n3,n4')

        })
    })

    describe('Methods: validateField', function(){
        it('should return null if the name is correctly set', function(){
            const tmfUtils = getTmfUtils();
            const name = 'correctName'
            const result = tmfUtils.validateNameField(name, 'product')
            expect(result).toBe(null)

        })

        it('should return an error 422 if the name is empty', function(){
            const tmfUtils = getTmfUtils();
            const name = ''
            const result = tmfUtils.validateNameField(name, 'product')
            expect(result).toBe('product name is empty')

        })

        it('should return an error 422 if the name is over 100 characters', function(){
            const tmfUtils = getTmfUtils();
            const name = 'a'.repeat(101)
            const result = tmfUtils.validateNameField(name, 'product')
            expect(result).toBe('product name is too long, it must be less than 100 characters')

        })

        it('should return an error 422 if the name is not a string', function(){
            const tmfUtils = getTmfUtils();
            const name = 7
            const result = tmfUtils.validateNameField(name, 'product')
            expect(result).toBe('product name must be a string')

        })
    })

    describe('Methods: validateCharacteristics', function(){
        it('should return true if all characteristics have unique names', function(){
            const tmfUtils = getTmfUtils();
            const chars = [
                { name: 'Color', value: 'Red' },
                { name: 'Size', value: 'Large' },
                { name: 'Weight', value: '10kg' }
            ]
            const result = tmfUtils.validateCharacteristics(chars)
            expect(result).toBe(true)
        })

        it('should return false if there are duplicate characteristic names', function(){
            const tmfUtils = getTmfUtils();
            const chars = [
                { name: 'Color', value: 'Red' },
                { name: 'Size', value: 'Large' },
                { name: 'Color', value: 'Blue' }
            ]
            const result = tmfUtils.validateCharacteristics(chars)
            expect(result).toBe(false)
        })

        it('should return true for an empty array', function(){
            const tmfUtils = getTmfUtils();
            const chars = []
            const result = tmfUtils.validateCharacteristics(chars)
            expect(result).toBe(true)
        })

        it('should return true for a single characteristic', function(){
            const tmfUtils = getTmfUtils();
            const chars = [
                { name: 'Color', value: 'Red' }
            ]
            const result = tmfUtils.validateCharacteristics(chars)
            expect(result).toBe(true)
        })

        it('should return false when first duplicate appears', function(){
            const tmfUtils = getTmfUtils();
            const chars = [
                { name: 'Color', value: 'Red' },
                { name: 'Color', value: 'Blue' },
                { name: 'Size', value: 'Large' }
            ]
            const result = tmfUtils.validateCharacteristics(chars)
            expect(result).toBe(false)
        })

        it('should return true when characteristic has valid range (valueFrom < valueTo)', function(){
            const tmfUtils = getTmfUtils();
            const chars = [
                {
                    name: 'Temperature',
                    productSpecCharacteristicValue: [
                        { valueFrom: 10, valueTo: 50 }
                    ]
                }
            ]
            const result = tmfUtils.validateCharacteristics(chars)
            expect(result).toBe(true)
        })

        it('should return false when valueFrom >= valueTo', function(){
            const tmfUtils = getTmfUtils();
            const chars = [
                {
                    name: 'Temperature',
                    productSpecCharacteristicValue: [
                        { valueFrom: 50, valueTo: 10 }
                    ]
                }
            ]
            const result = tmfUtils.validateCharacteristics(chars)
            expect(result).toBe(false)
        })

        it('should return false when valueFrom equals valueTo', function(){
            const tmfUtils = getTmfUtils();
            const chars = [
                {
                    name: 'Temperature',
                    productSpecCharacteristicValue: [
                        { valueFrom: 25, valueTo: 25 }
                    ]
                }
            ]
            const result = tmfUtils.validateCharacteristics(chars)
            expect(result).toBe(false)
        })

        it('should return false when multiple values exist with range defined', function(){
            const tmfUtils = getTmfUtils();
            const chars = [
                {
                    name: 'Temperature',
                    productSpecCharacteristicValue: [
                        { valueFrom: 10, valueTo: 50 },
                        { value: 'Hot' }
                    ]
                }
            ]
            const result = tmfUtils.validateCharacteristics(chars)
            expect(result).toBe(false)
        })

        it('should return true when characteristic has no productSpecCharacteristicValue', function(){
            const tmfUtils = getTmfUtils();
            const chars = [
                { name: 'Color' },
                { name: 'Size' }
            ]
            const result = tmfUtils.validateCharacteristics(chars)
            expect(result).toBe(true)
        })

        it('should return true when characteristic has multiple discrete values without range', function(){
            const tmfUtils = getTmfUtils();
            const chars = [
                {
                    name: 'Color',
                    productSpecCharacteristicValue: [
                        { value: 'Red' },
                        { value: 'Blue' },
                        { value: 'Green' }
                    ]
                }
            ]
            const result = tmfUtils.validateCharacteristics(chars)
            expect(result).toBe(true)
        })
    })
    
    describe('Methods: hasValidPhoneNumber', function(){
        it('should return true if telephone number is correct', function(){
            const tmfUtils = getTmfUtils();
            const tel = '+34630000000'
            const result = tmfUtils.isValidPhoneNumber(tel)
            expect(result).toBe(true)
        })

        it('should return false if telephone number is incorrect in length', function(){
            const tmfUtils = getTmfUtils();
            const tel = '+346300000001'
            const result = tmfUtils.isValidPhoneNumber(tel)
            expect(result).toBe(false)
        })

        it('should return false if telephone number is incorrect in format', function(){
            const tmfUtils = getTmfUtils();
            const tel = '+34-630000000'
            const result = tmfUtils.isValidPhoneNumber(tel)
            expect(result).toBe(false)
        })

        it('should return false if telephone is undefined', function(){
            const tmfUtils = getTmfUtils();
            const tel = undefined
            const result = tmfUtils.isValidPhoneNumber(tel)
            expect(result).toBe(false)
        })

    });

    describe('Methods: validateOfferingPrice', function(){

        it('should return true if the price is a number and is correctly set following ISO 4217 standard', function(){
            const tmfUtils = getTmfUtils();
            const price = 4.99
            const unit = 'EUR'
            const result = tmfUtils.isValidPrice(price, unit)
            expect(result).toBe(true)

        })

        it('should return true if the price is a string and is correctly set following ISO 4217 standard', function(){
            const tmfUtils = getTmfUtils();
            const price = '4.99'
            const unit = 'EUR'
            const result = tmfUtils.isValidPrice(price, unit)
            expect(result).toBe(true)

        })

        it('should return false if the price is not a number or string', function(){
            const tmfUtils = getTmfUtils();
            const price = {}
            const unit = 'EUR'
            const result = tmfUtils.isValidPrice(price, unit)
            expect(result).toBe(false)

        })

        it('should return false if the price is not following ISO 4217 standard', function(){
            const tmfUtils = getTmfUtils();
            const price = 4.992
            const unit = 'EUR'
            const result = tmfUtils.isValidPrice(price, unit)
            expect(result).toBe(false)

        })

        it('should return false if the price is out of the interval', function(){
            const tmfUtils = getTmfUtils();
            const price = '1000000000000000'
            const unit = 'EUR'
            const result = tmfUtils.isValidPrice(price, unit)
            expect(result).toBe(false)

        })

        it('should return true if percentage is between 0 and 100', function(){
            const tmfUtils = getTmfUtils();
            const percentage = 50
            const result = tmfUtils.isValidPercentage(percentage)
            expect(result).toBe(true)

        })

        it('should return true if percentage is a string and is between 0 and 100', function(){
            const tmfUtils = getTmfUtils();
            const percentage = '50'
            const result = tmfUtils.isValidPercentage(percentage)
            expect(result).toBe(true)

        })

        it('should return false if percentage is not a number or string', function(){
            const tmfUtils = getTmfUtils();
            const percentage = null
            const result = tmfUtils.isValidPercentage(percentage)
            expect(result).toBe(false)

        })

        it('should return false if percentage is not between 0 and 100', function(){
            const tmfUtils = getTmfUtils();
            const percentage = 150
            const result = tmfUtils.isValidPercentage(percentage)
            expect(result).toBe(false)

        })

        it('should return true if amount is more or equal than 1', function(){
            const tmfUtils = getTmfUtils();
            const amount = 1
            const result = tmfUtils.isValidAmount(amount)
            expect(result).toBe(true)
        })

        it('should return true if amount is a valid string', function(){
            const tmfUtils = getTmfUtils();
            const amount = '1'
            const result = tmfUtils.isValidAmount(amount)
            expect(result).toBe(true)
        })

        it('should return false if amount is not a number or string', function(){
            const tmfUtils = getTmfUtils();
            const amount = {}
            const result = tmfUtils.isValidAmount(amount)
            expect(result).toBe(false)

        })

        it('should return false if amount is less than 1', function(){
            const tmfUtils = getTmfUtils();
            const amount = 0.99
            const result = tmfUtils.isValidAmount(amount)
            expect(result).toBe(false)

        })
    })

    describe('Attach related party', () => {
        beforeEach(() => {
            config.federationEnabled = false;
        });

        afterEach(() => {
            config.federationEnabled = false;
        });

        const getOpTmfUtils = function(utils) {
            return proxyquire('../../lib/tmfUtils', {
                './../config': config,
                './utils': utils || {},
                './operator': {
                    operator: {
                        getOperatorId: () => {
                            return 'urn:organization:operatorId';
                        }
                    }
                },
                './party': {
                    partyClient: {
                        getOrganization: async (partyId) => {
                            return {
                                body: {
                                    externalReference: [{
                                        externalReferenceType: 'idm_id',
                                        name: partyId === 'urn:organization:partyId'
                                            ? 'VAT-ID1'
                                            : 'VAT-ID2'
                                }]}
                            }
                        }
                    }
                }
            });
        };

        const getFederatedOpTmfUtils = function() {
            config.federationEnabled = true;

            const partyClient = {
                getOrganization: jasmine.createSpy('getOrganization').and.callFake(async (partyId) => {
                    if (partyId === 'urn:organization:buyerId') {
                        return {
                            body: {
                                externalReference: [{
                                    externalReferenceType: 'idm_id',
                                    name: 'VAT-ID2'
                                }]
                            }
                        };
                    }

                    return {
                        body: {
                            externalReference: [{
                                externalReferenceType: 'idm_id',
                                name: 'VAT-ID1'
                            }]
                        }
                    };
                }),
                getIndividual: jasmine.createSpy('getIndividual').and.returnValue(Promise.resolve({ body: {} })),
                getOrganizationsByQueryInApi: jasmine.createSpy('getOrganizationsByQueryInApi').and.callFake(async (_, query) => {
                    if (query.includes('VAT-ID1')) {
                        return {
                            body: [{
                                id: 'urn:organization:remoteSellerId',
                                href: 'urn:organization:remoteSellerId'
                            }]
                        };
                    }

                    if (query.includes('VAT-ID2')) {
                        return {
                            body: [{
                                id: 'urn:organization:remoteBuyerId',
                                href: 'urn:organization:remoteBuyerId'
                            }]
                        };
                    }

                    if (query.includes('VAT-OP')) {
                        return {
                            body: [{
                                id: 'urn:organization:remoteOperatorId',
                                href: 'urn:organization:remoteOperatorId'
                            }]
                        };
                    }

                    return { body: [] };
                }),
                getIndividualsByQueryInApi: jasmine.createSpy('getIndividualsByQueryInApi').and.returnValue(Promise.resolve({ body: [] }))
            };

            const resolveTmforumEndpoint = jasmine.createSpy('resolveTmforumEndpoint').and.returnValue(
                Promise.resolve('https://federated.example.com/tmf')
            );
            const resolveTmforumEndpointByPartyId = jasmine.createSpy('resolveTmforumEndpointByPartyId').and.returnValue(
                Promise.resolve('https://federated.example.com/tmf')
            );

            const tmfUtils = proxyquire('../../lib/tmfUtils', {
                './../config': config,
                './utils': {},
                './operator': {
                    operator: {
                        getOperatorId: () => {
                            return 'urn:organization:operatorId';
                        }
                    }
                },
                './party': {
                    partyClient: partyClient
                },
                './federation': {
                    federation: {
                        resolveTmforumEndpoint: resolveTmforumEndpoint,
                        resolveTmforumEndpointByPartyId: resolveTmforumEndpointByPartyId
                    }
                }
            });

            return {
                tmfUtils: tmfUtils,
                partyClient: partyClient,
                resolveTmforumEndpoint: resolveTmforumEndpoint,
                resolveTmforumEndpointByPartyId: resolveTmforumEndpointByPartyId
            };
        };

        const testAttach = async (api, path, body, resp) => {
            const tmfUtils = getOpTmfUtils();

            const req = {
                apiUrl: path,
                headers: {},
                body: JSON.stringify(body),
                user: {
                    id: 'VAT-ID1',
                    partyId: 'urn:organization:partyId',
                }
            }
            await tmfUtils.attachRelatedParty(req, api);

            const newBody = JSON.parse(req.body);
            expect(newBody.relatedParty).toEqual(resp)

            return newBody;
        };

        const testAttachSupported = async (api, path, body) => {
            return testAttach(api, path, body, [{
                id: 'urn:organization:partyId',
                href: 'urn:organization:partyId',
                name: 'VAT-ID1',
                role: 'Seller',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:operatorId',
                href: 'urn:organization:operatorId',
                name: 'VAT-OP',
                role: 'SellerOperator',
                "@referredType": "Organization"
            }]);
        }

        const testAttachNotSupported = async (api, path) => {
            const newBody = await testAttachSupported(api, path, {})

            expect(newBody['@schemaLocation']).toEqual('https://mylocation.com/schema.json')
        }

        const testAttachSpec = async (api, path) => {
            await testAttachSupported(api, path, {
                relatedParty: [{
                    id: 'urn:organization:partyId',
                    role: 'Seller'
                }]
            })
        }

        it('should attach related party to a product spec', async () => {
            await testAttachSpec('catalog', '/productSpecification')
        });

        it('should attach related party to a catalog', async () => {
            await testAttachSupported('catalog', '/catalog', {
                relatedParty: []
            })
        });

        it('should attach related party to a product offering', async () => {
            await testAttachNotSupported('catalog', '/productOffering')
        });

        it('should attach related party to a product offering with Buyer', async () => {
            await testAttach('catalog', '/productOffering', {
                relatedParty: [{
                    id: 'urn:organization:buyerId',
                    role: 'Buyer'
                }]
            }, [{
                id: 'urn:organization:buyerId',
                href: 'urn:organization:buyerId',
                name: 'VAT-ID2',
                role: 'Buyer',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:partyId',
                href: 'urn:organization:partyId',
                name: 'VAT-ID1',
                role: 'Seller',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:operatorId',
                href: 'urn:organization:operatorId',
                name: 'VAT-OP',
                role: 'SellerOperator',
                "@referredType": "Organization"
            }])

        });

        it('should treat related party as organization when id includes organization even if referred type differs', async () => {
            await testAttach('catalog', '/productOffering', {
                relatedParty: [{
                    id: 'urn:organization:buyerId',
                    role: 'Buyer',
                    "@referredType": "Individual"
                }]
            }, [{
                id: 'urn:organization:buyerId',
                href: 'urn:organization:buyerId',
                name: 'VAT-ID2',
                role: 'Buyer',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:partyId',
                href: 'urn:organization:partyId',
                name: 'VAT-ID1',
                role: 'Seller',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:operatorId',
                href: 'urn:organization:operatorId',
                name: 'VAT-OP',
                role: 'SellerOperator',
                "@referredType": "Organization"
            }])
        });

        it('should attach related party to a product offering price', async () => {
            await testAttachNotSupported('catalog', '/productOfferingPrice')
        });

        it('should attach related party to a category', async () => {
            const newBody = await testAttach('catalog', '/category', {}, [{
                id: 'urn:organization:operatorId',
                href: 'urn:organization:operatorId',
                name: 'VAT-OP',
                role: 'SellerOperator',
                "@referredType": "Organization"
            }]);

            expect(newBody['@schemaLocation']).toEqual('https://mylocation.com/schema.json')
        });

        it('should attach related party to a service spec', async () => {
            await testAttachSpec('service', '/serviceSpecification')
        });

        it('should attach related party to a resource spec', async () => {
            await testAttachSpec('resource', '/resourceSpecification')
        });

        it('should attach related party to a product order', async () => {
            await testAttach('ordering', '/productOrder', {
                relatedParty: [{
                    id: 'urn:organization:partyId',
                    role: 'Seller'
                }, {
                    id: 'urn:organization:partyId2',
                    role: 'Buyer'
                }]
            }, [{
                id: 'urn:organization:partyId',
                href: 'urn:organization:partyId',
                name: 'VAT-ID1',
                role: 'Seller',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:operatorId',
                href: 'urn:organization:operatorId',
                name: 'VAT-OP',
                role: 'SellerOperator',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:partyId2',
                href: 'urn:organization:partyId2',
                name: 'VAT-ID2',
                role: 'Buyer',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:operatorId',
                href: 'urn:organization:operatorId',
                name: 'VAT-OP',
                role: 'BuyerOperator',
                "@referredType": "Organization"
            }]);
        });

        it('should attach related party to a billing account', async () => {
            await testAttachSpec('account', '/billingAccount')
        });

        it('should attach related party to a usage spec', async () => {
            await testAttachSpec('usage', '/usageSpecification')
        });

        it('should map related parties to remote IDs when federation endpoint is enabled', async () => {
            const utilsObj = getFederatedOpTmfUtils();
            const req = {
                apiUrl: '/productOrder',
                headers: {},
                body: JSON.stringify({
                    relatedParty: [{
                        id: 'urn:organization:partyId',
                        role: 'Seller'
                    }, {
                        id: 'urn:organization:buyerId',
                        role: 'Buyer'
                    }]
                }),
                user: {
                    id: 'VAT-ID1',
                    userId: 'individual-user-1',
                    partyId: 'urn:organization:partyId'
                }
            };

            await utilsObj.tmfUtils.attachRelatedParty(req, 'ordering');

            const newBody = JSON.parse(req.body);
            expect(newBody.relatedParty).toEqual([{
                id: 'urn:organization:remoteSellerId',
                href: 'urn:organization:remoteSellerId',
                name: 'VAT-ID1',
                role: 'Seller',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:remoteSellerId',
                href: 'urn:organization:remoteSellerId',
                name: 'VAT-ID1',
                role: 'SellerOperator',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:remoteBuyerId',
                href: 'urn:organization:remoteBuyerId',
                name: 'VAT-ID2',
                role: 'Buyer',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:remoteSellerId',
                href: 'urn:organization:remoteSellerId',
                name: 'VAT-ID1',
                role: 'BuyerOperator',
                "@referredType": "Organization"
            }]);

            expect(utilsObj.resolveTmforumEndpointByPartyId).toHaveBeenCalledWith('urn:organization:partyId');
            expect(utilsObj.partyClient.getOrganizationsByQueryInApi.calls.count()).toBe(2);
        });

        it('should resolve federated seller IDs using current user external reference', async () => {
            const utilsObj = getFederatedOpTmfUtils();

            utilsObj.partyClient.getOrganization.and.callFake(async () => {
                return {
                    body: {
                        externalReference: [{
                            externalReferenceType: 'idm_id',
                            name: 'EORI-SELLER'
                        }]
                    }
                };
            });

            utilsObj.partyClient.getOrganizationsByQueryInApi.and.callFake(async (_, query) => {
                if (query.includes('LOCAL-SESSION-ID')) {
                    return {
                        body: [{
                            id: 'urn:organization:remoteSellerId',
                            href: 'urn:organization:remoteSellerId'
                        }]
                    };
                }

                return { body: [] };
            });

            const req = {
                apiUrl: '/catalog',
                headers: {},
                body: JSON.stringify({
                    relatedParty: []
                }),
                user: {
                    id: 'LOCAL-SESSION-ID',
                    userId: 'individual-user-1',
                    partyId: 'urn:organization:partyId'
                }
            };

            await utilsObj.tmfUtils.attachRelatedParty(req, 'catalog');

            const newBody = JSON.parse(req.body);
            expect(newBody.relatedParty).toEqual([{
                id: 'urn:organization:remoteSellerId',
                href: 'urn:organization:remoteSellerId',
                name: 'LOCAL-SESSION-ID',
                role: 'Seller',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:remoteSellerId',
                href: 'urn:organization:remoteSellerId',
                name: 'LOCAL-SESSION-ID',
                role: 'SellerOperator',
                "@referredType": "Organization"
            }]);

            expect(utilsObj.partyClient.getOrganizationsByQueryInApi).toHaveBeenCalledWith(
                'https://federated.example.com/tmf',
                'externalReference.name=LOCAL-SESSION-ID'
            );
            expect(utilsObj.partyClient.getOrganizationsByQueryInApi.calls.count()).toBe(1);
        });

        it('should use seller as federation source for product orders when requester is not the seller', async () => {
            const utilsObj = getFederatedOpTmfUtils();
            const req = {
                apiUrl: '/productOrder',
                headers: {},
                body: JSON.stringify({
                    relatedParty: [{
                        id: 'urn:organization:sellerId',
                        role: 'Seller'
                    }, {
                        id: 'urn:organization:buyerId',
                        role: 'Buyer'
                    }]
                }),
                user: {
                    id: 'VAT-ID2',
                    userId: 'individual-user-2',
                    partyId: 'urn:organization:buyerId'
                }
            };

            await utilsObj.tmfUtils.attachRelatedParty(req, 'ordering');

            const newBody = JSON.parse(req.body);
            expect(newBody.relatedParty).toEqual([{
                id: 'urn:organization:remoteSellerId',
                href: 'urn:organization:remoteSellerId',
                name: 'VAT-ID1',
                role: 'Seller',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:remoteSellerId',
                href: 'urn:organization:remoteSellerId',
                name: 'VAT-ID1',
                role: 'SellerOperator',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:remoteBuyerId',
                href: 'urn:organization:remoteBuyerId',
                name: 'VAT-ID2',
                role: 'Buyer',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:remoteSellerId',
                href: 'urn:organization:remoteSellerId',
                name: 'VAT-ID1',
                role: 'BuyerOperator',
                "@referredType": "Organization"
            }]);

            expect(utilsObj.resolveTmforumEndpointByPartyId).toHaveBeenCalledWith('urn:organization:sellerId');
            expect(utilsObj.resolveTmforumEndpointByPartyId).not.toHaveBeenCalledWith('urn:organization:buyerId');
        });

        it('should skip federated lookup for individual related parties', async () => {
            const utilsObj = getFederatedOpTmfUtils();
            utilsObj.partyClient.getIndividual.and.returnValue(Promise.resolve({
                body: {
                    externalReference: [{
                        externalReferenceType: 'idm_id',
                        name: 'IND-ID1'
                    }]
                }
            }));
            utilsObj.partyClient.getIndividualsByQueryInApi.and.returnValue(Promise.resolve({
                body: [{
                    id: 'urn:individual:remoteBuyerId',
                    href: 'urn:individual:remoteBuyerId'
                }]
            }));

            const req = {
                apiUrl: '/productOrder',
                headers: {},
                body: JSON.stringify({
                    relatedParty: [{
                        id: 'urn:organization:partyId',
                        role: 'Seller'
                    }, {
                        id: 'urn:individual:buyerId',
                        role: 'Buyer',
                        '@referredType': 'Individual'
                    }]
                }),
                user: {
                    id: 'VAT-ID1',
                    userId: 'individual-user-1',
                    partyId: 'urn:organization:partyId'
                }
            };

            await utilsObj.tmfUtils.attachRelatedParty(req, 'ordering');

            const newBody = JSON.parse(req.body);
            expect(newBody.relatedParty).toEqual([{
                id: 'urn:organization:remoteSellerId',
                href: 'urn:organization:remoteSellerId',
                name: 'VAT-ID1',
                role: 'Seller',
                "@referredType": "Organization"
            }, {
                id: 'urn:organization:remoteSellerId',
                href: 'urn:organization:remoteSellerId',
                name: 'VAT-ID1',
                role: 'SellerOperator',
                "@referredType": "Organization"
            }, {
                id: 'urn:individual:buyerId',
                href: 'urn:individual:buyerId',
                name: 'IND-ID1',
                role: 'Buyer',
                "@referredType": "Individual"
            }, {
                id: 'urn:organization:remoteSellerId',
                href: 'urn:organization:remoteSellerId',
                name: 'VAT-ID1',
                role: 'BuyerOperator',
                "@referredType": "Organization"
            }]);

            expect(utilsObj.partyClient.getIndividualsByQueryInApi).not.toHaveBeenCalled();
            expect(utilsObj.partyClient.getOrganizationsByQueryInApi.calls.count()).toBe(1);
        });

        it('should skip federation resolution for individual users even with userId', async () => {
            const utilsObj = getFederatedOpTmfUtils();
            const req = {
                apiUrl: '/productSpecification',
                headers: {},
                body: JSON.stringify({
                    relatedParty: [{
                        id: 'urn:individual:partyId',
                        role: 'Seller'
                    }]
                }),
                user: {
                    id: 'VAT-ID1',
                    userId: 'individual-user-1',
                    partyId: 'urn:individual:partyId'
                }
            };

            await utilsObj.tmfUtils.attachRelatedParty(req, 'catalog');

            expect(utilsObj.resolveTmforumEndpointByPartyId).not.toHaveBeenCalled();
            expect(utilsObj.partyClient.getOrganizationsByQueryInApi).not.toHaveBeenCalled();
        });
    })
});
