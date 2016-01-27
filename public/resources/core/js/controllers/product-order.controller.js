/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    // Status for process that takes a while to load (load orders & create order)
    var LOADING = 'LOADING';
    var LOADED = 'LOADED';
    var ERROR = 'ERROR';
    var INITIAL = 'INITIAL';
    var FINISHED = 'FINISHED';

    angular
        .module('app')
        .controller('ProductOrderCreateCtrl', ProductOrderCreateController);

    function ProductOrderCreateController($state, $rootScope, $window, $interval, User, ProductOrder, ShoppingCart, Utils, EVENTS) {
        /* jshint validthis: true */
        var vm = this;

        vm.makeOrder = makeOrder;
        vm.toggleCollapse = toggleCollapse;
        vm.createOrderStatus = INITIAL;

        function toggleCollapse(id) {
            $('#' + id).collapse('toggle');
        }

        var initOrder = function initOrder() {

            vm.loadingStatus = LOADING;

            ShoppingCart.getItems().then(function(orderItems) {

                vm.loadingStatus = LOADED;

                // Initialize order
                vm.orderInfo = {
                    state: 'Acknowledged',
                    orderItem: [],
                    relatedParty: [User.serializeBasic()]
                };

                vm.orderInfo.relatedParty[0].role = 'Customer';

                // Build order items. This information is created using the shopping card and is not editable in this view
                for (var i = 0; i < orderItems.length; i++) {
                    var item = {
                        id: i.toString(),
                        action: 'add',
                        state: 'Acknowledged',
                        productOffering: {
                            id: orderItems[i].id,
                            name: orderItems[i].name,
                            href: orderItems[i].href
                        },
                        product: {
                            productCharacteristic: []
                        },
                        billingAccount: [User.serializeBasic()]
                    };

                    // Use pricing and characteristics to build the product property
                    if (orderItems[i].options.characteristics) {
                        for (var j = 0; j < orderItems[i].options.characteristics.length; j++) {
                            var char = orderItems[i].options.characteristics[j].characteristic;
                            var selectedValue = orderItems[i].options.characteristics[j].value;
                            var value;

                            if (char.valueType.toLowerCase() === 'string' ||
                                (char.valueType.toLowerCase() === 'number' && selectedValue.value)) {
                                value = selectedValue.value;
                            } else {
                                value = selectedValue.valueFrom + '-' + selectedValue.valueTo;
                            }

                            item.product.productCharacteristic.push({
                                name: char.name,
                                value: value
                            });
                        }
                    }

                    if (orderItems[i].options.pricing) {
                        var price = orderItems[i].options.pricing;
                        price.price = {
                            amount: orderItems[i].options.pricing.price.taxIncludedAmount,
                            currency: orderItems[i].options.pricing.price.currencyCode
                        };
                        item.product.productPrice = [price];
                    }

                    // Include the item to the order
                    vm.orderInfo.orderItem.push(item);
                }

            }, function (response) {
                vm.error = Utils.parseError(response, 'It was impossible to load your shopping cart');
                vm.loadingStatus = ERROR;
            });
        };

        function makeOrder() {

            vm.createOrderStatus = LOADING;

            var cleanCartItems = function() {
                ShoppingCart.cleanItems().then(function() {
                    $rootScope.$broadcast(EVENTS.ORDER_CREATED);
                });
            };

            // Fix display fields to accommodate API restrictions
            var apiInfo = angular.copy(vm.orderInfo);
            for (var i = 0; i < apiInfo.orderItem.length; i++) {
                delete apiInfo.orderItem[i].productOffering.name;
                if (!apiInfo.orderItem[i].product.productCharacteristic.length) {
                    apiInfo.orderItem[i].product.productCharacteristic.push({});
                }
            }

            ProductOrder.create(apiInfo).then(function(orderCreated) {
                if ('x-redirect-url' in orderCreated.headers) {
                    var ppalWindow = $window.open(orderCreated.headers['x-redirect-url'], '_blank');

                    // Display a message and wait until the new tab has been closed to redirect the page
                    $rootScope.$emit(EVENTS.MESSAGE_CREATED);
                    var interval = $interval(function() {
                        if (ppalWindow.closed) {
                            vm.createOrderStatus = FINISHED;
                            $interval.cancel(interval);
                            $rootScope.$emit(EVENTS.MESSAGE_CLOSED);
                            cleanCartItems();
                            $state.go('inventory');
                        }
                    }, 500);

                } else {
                    vm.createOrderStatus = FINISHED;
                    cleanCartItems();
                    $state.go('inventory');
                }
            }, function (response) {

                vm.createOrderStatus = ERROR;

                var defaultMessage = 'There was an unexpected error that prevented the ' +
                    'system from creating a new order';
                var error = Utils.parseError(response, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            });
        }

        initOrder();
    }

})();
