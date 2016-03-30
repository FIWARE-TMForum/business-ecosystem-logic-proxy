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
        .controller('ProductOrderSearchCtrl', ProductOrderSearchController)
        .controller('ProductOrderCreateCtrl', ProductOrderCreateController)
        .controller('ProductOrderDetailCtrl', ProductOrderDetailController);

    function ProductOrderSearchController($state, $rootScope, EVENTS, PRODUCTORDER_STATUS, PRODUCTORDER_LIFECYCLE, ProductOrder, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.state = $state;
        vm.role = $state.params.role;

        vm.list = [];
        vm.list.status = LOADING;

        vm.isTransitable = isTransitable;
        vm.getNextStatus = getNextStatus;
        vm.showFilters = showFilters;
        vm.updateStatus = updateStatus;
        vm.canCancel = canCancel;
        vm.cancelOrder = cancelOrder;
        vm.cancellingOrder = false;

        ProductOrder.search($state.params).then(function (productOrderList) {
            angular.copy(productOrderList, vm.list);
            vm.list.status = LOADED;
        }, function (response) {
            vm.error = Utils.parseError(response, 'It was impossible to load the list of catalogs');
            vm.list.status = ERROR;
        });

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, PRODUCTORDER_STATUS);
        }

        function isTransitable(orderItem) {

            return orderItem.state === PRODUCTORDER_STATUS.ACKNOWLEDGED || orderItem.state === PRODUCTORDER_STATUS.INPROGRESS;
        }

        function getNextStatus(orderItem) {
            var index = PRODUCTORDER_LIFECYCLE.indexOf(orderItem.state);
            return index !== -1 && (index + 1) !== PRODUCTORDER_LIFECYCLE.length ? PRODUCTORDER_LIFECYCLE[index + 1] : null;
        }

        function canCancel(productOrder) {
            return productOrder.state === PRODUCTORDER_STATUS.INPROGRESS && productOrder.orderItem.every(function (orderItem) {
                return orderItem.state === PRODUCTORDER_STATUS.ACKNOWLEDGED;
            });
        }

        function cancelOrder(productOrder) {
            var dataUpdated = {
                state: PRODUCTORDER_STATUS.CANCELLED
            };

            vm.cancellingOrder = true;

            ProductOrder.update(productOrder, dataUpdated).then(function (productOrderUpdated) {
                angular.copy(productOrderUpdated, productOrder);
                vm.cancellingOrder = false;
            }, function (response) {
                var defaultMessage = 'There was an unexpected error that prevented the ' +
                    'system from updating the status of the given product order';
                var error = Utils.parseError(response, defaultMessage);

                vm.cancellingOrder = false;
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            });
        }

        function updateStatus(productOrder, index, status) {
            var dataUpdated = {
                orderItem: angular.copy(productOrder.orderItem)
            };

            dataUpdated.orderItem[index].state = status;
            dataUpdated.orderItem.forEach(function (orderItem) {
                orderItem.productOffering = orderItem.productOffering.serialize();
            });
            ProductOrder.update(productOrder, dataUpdated).then(function (productOrderUpdated) {
                angular.copy(productOrderUpdated, productOrder);
            }, function (response) {
                var defaultMessage = 'There was an unexpected error that prevented the ' +
                    'system from updating the given product order';
                var error = Utils.parseError(response, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            });
        }
    }

    function ProductOrderCreateController($state, $rootScope, $window, $interval, User, ProductOrder, Offering, ShoppingCart, Utils, EVENTS) {
        /* jshint validthis: true */
        var vm = this;

        vm.makeOrder = makeOrder;
        vm.toggleCollapse = toggleCollapse;
        vm.createOrderStatus = INITIAL;
        vm.formatPriceplan = formatPriceplan;

        function toggleCollapse(id) {
            $('#' + id).collapse('toggle');
        }

        var initOrder = function initOrder() {

            vm.loadingStatus = LOADING;

            ShoppingCart.getItems().then(function(orderItems) {

                vm.loadingStatus = LOADED;

                if (orderItems.length) {

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
                } else {
                    $state.go('offering');
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'info', {
                        message: 'No items found on your shopping cart!'
                    });
                }

            }, function (response) {
                vm.error = Utils.parseError(response, 'It was impossible to load your shopping cart');
                vm.loadingStatus = ERROR;
            });
        };

        function formatPriceplan(orderItem) {
            var result, priceplan;

            if (angular.isArray(orderItem.product.productPrice) && orderItem.product.productPrice.length) {
                priceplan = orderItem.product.productPrice[0];
                result = priceplan.price.amount + " " + priceplan.price.currency;
                switch (priceplan.priceType) {
                case Offering.PRICE_TYPES.RECURRING:
                    result += " / " + priceplan.recurringChargePeriod;
                    break;
                case Offering.PRICE_TYPES.USAGE:
                    result += " / " + priceplan.unitOfMeasure;
                    break;
                }
            } else {
                result = "Free";
            }

            return result;
        }

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
                    var interval;

                    // The function to be called when the payment process has ended
                    var paymentFinished = function(closeModal) {

                        if (interval) {
                            $interval.cancel(interval);
                        }

                        if (closeModal) {
                            $rootScope.$emit(EVENTS.MESSAGE_CLOSED);
                        }

                        vm.createOrderStatus = FINISHED;
                        cleanCartItems();
                        $state.go('inventory');

                    };

                    // Display a message and wait until the new tab has been closed to redirect the page
                    $rootScope.$emit(EVENTS.MESSAGE_CREATED, orderCreated.headers['x-redirect-url'], paymentFinished.bind(this, false));

                    if (ppalWindow) {
                        interval = $interval(function () {
                            if (ppalWindow.closed) {
                                paymentFinished(true);
                            }
                        }, 500);
                    }

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

    function ProductOrderDetailController($state, Utils, ProductOrder) {
        /* jshint validthis: true */
        var vm = this;

        vm.item = {};

        ProductOrder.detail($state.params.productOrderId).then(function (productOrderRetrieved) {
            vm.item = productOrderRetrieved;
            vm.item.status = LOADED;
        }, function (response) {
            vm.error = Utils.parseError(response, 'The requested product order could not be retrieved');
            vm.item.status = ERROR;
        });
    }

})();
