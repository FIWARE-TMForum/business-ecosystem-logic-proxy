/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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
 * @author Daniel Puschmann <daniel.puschmann@digicatapult.org.uk>
 */

 (function (){
    'use strict';

    angular
        .module('app')
        .factory('DatastoreSer', DatastoreService);

    function DatastoreService($q, $resource, URLS, LIFECYCLE_STATUS, User) {

        // This service is very similar to the ProductSpecificationService, however, it is able to provide multiple
        // Data source specifications at once
        var datastore = buildInitialData();

        var VALUE_TYPES = {
            STRING: 'String',
            NUMBER: 'Number',
            NUMBER_RANGE: 'Number range'
        };

        var EVENTS= {
            UPDATED: '$datastoreSerUpdated'
        };

        var TYPES = {
            RELATIONSHIP: {
                DEPENDENCY: {code: 'dependency', name: 'Dependency'},
                EXCLUSIVITY: {code: 'exclusivity', name: 'Exclusivity'},
                MIGRATION: {code: 'migration', name: 'Substitution'}
            }
        };
//      Don't think we need relationship for the productspecs imported from a datastore
//        var Relationship = function Relationship(productSpec, relationshipType, index){
//            this.productSpec = productSpec;
//            this.type = relationshipType;
//        };
//
//        Relationship.prototype.parseType = function toJSON() {
//            for(var key in TYPES.RELATIONSHIP){
//                if (TYPES.RELATIONSHIP[key].code == this.type){
//                    return TYPES.RELATIONSHIP[key].name;
//                }
//            }
//            return "";
//        }
//
//        Relationship.prototype.toJSON = function toJSON() {
//            return {
//                id:this.productSpec.id,
//                href: this.productSpec.href,
//                type: this.type
//            };
//        };

        for(var i=0; i<datastore.ProductSpecs.length; i++){
            datastore.ProductSpecs[i].prototype.getPicture = getPicture;
            datastore.ProductSpecs[i].prototype.getCharacteristicDefaultValue = getCharacteristicDefaultValue;
            datastore.ProductSpecs[i].prototype.serialize = serialize;
            datastore.ProductSpecs[i].prototype.appendRelationship = appendRelationship;
            datastore.ProductSpecs[i].prototype.removeRelationship = removeRelationship;
        };

        return {
            // Put here all the methods that need to be returned
            VALUE_TYPES: VALUE_TYPES,
            TYPES: TYPES,
            create: create,
            update: update,
            buildInitialData: buildInitialData,
            createCharacteristic: createCharacteristic,
            createCharacteristicValue: createCharacteristicValue,
            datastore: datastore
        };


        function create(dataList) {
            var deferred = $q.defer();
            for (var i=0; i<dataList.length; i++){
                data[i].productSpecCharateristic.forEach(function (characteristic){
                    if(characteristic.valueType === VALUE_TYPES.NUMBER_RANGE){
                        characteristic.valueType = VALUE_TYPES.NUMBER;
                    }
                    characteristic.valueType = characteristic.valueType.toLowerCase();
                });
            }
        }

        function registerCkanPackage(pckge){
            var baseUrl = datastore.baseUrl.endsWith('/')?datastore.baseUrl:datastore.baseUrl+'/';
            var packageUrl = baseUrl+pckge;
            var ProductSpec = $resource(URLS.CATALOGUE_MANAGEMENT + '/productSpecification/:poductSpecId', {
                productId: '@id'
            }, {
                update: {
                    method:'PUT'
                }
            });
        }

        function update(){

        }

        function buildInitialData(){
            return {
                lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                ProductSpecs: [],
                baseUrl: 'https://data.london.gov.uk/dataset/',
                relatedParty: [
                    User.serialize()
                ],
                description: '',
                prefix: ''
            }
        }

        function createCharacteristic(){
        }

        function createCharacteristicValue(){
        }


    }
 })();