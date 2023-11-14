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

/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */
(function() {
    'use strict';

    // Status for process that takes a while to load (load orders & create order)
    var LOADING = 'LOADING';
    var LOADED = 'LOADED';
    var ERROR = 'ERROR';
    var INITIAL = 'INITIAL';
    var FINISHED = 'FINISHED';

    angular
        .module('app')
        .controller('ProductOrderSearchCtrl', [
            '$scope',
            '$state',
            '$rootScope',
            'EVENTS',
            'PRODUCTORDER_STATUS',
            'PRODUCTORDER_LIFECYCLE',
            'ProductOrder',
            'Utils',
            ProductOrderSearchController
        ])

        .controller('ProductOrderCreateCtrl', [
            '$state',
            '$rootScope',
            '$scope',
            '$window',
            '$interval',
            'User',
            'ProductOrder',
            'Offering',
            'ShoppingCart',
            'Utils',
            'EVENTS',
            ProductOrderCreateController
        ])

        .controller('ProductOrderDetailCtrl', [
            '$rootScope',
            '$state',
            'EVENTS',
            'PROMISE_STATUS',
            'PRODUCTORDER_STATUS',
            'Utils',
            'User',
            'ProductOrder',
            ProductOrderDetailController
        ]);

    function ProductOrderSearchController(
        $scope,
        $state,
        $rootScope,
        EVENTS,
        PRODUCTORDER_STATUS,
        PRODUCTORDER_LIFECYCLE,
        ProductOrder,
        Utils
    ) {
        /* jshint validthis: true */
        var vm = this;

        vm.state = $state;
        vm.role = $state.params.role;

        vm.list = [];
        vm.list.status = LOADING;
        vm.offset = -1;
        vm.limit = -1;

        vm.isTransitable = isTransitable;
        vm.getNextStatus = getNextStatus;
        vm.showFilters = showFilters;
        vm.updateStatus = updateStatus;
        vm.canCancel = canCancel;
        vm.cancelOrder = cancelOrder;
        vm.getElementsLength = getElementsLength;

        vm.cancellingOrder = false;

        function productOrderSearch() {
            vm.list.status = LOADING;

            if (vm.offset >= 0) {
                var params = {};
                angular.copy($state.params, params);

                params.offset = vm.offset;
                params.limit = vm.limit;

                ProductOrder.search(params).then(
                    function(productOrderList) {
                        angular.copy(productOrderList, vm.list);
                        vm.list.status = LOADED;
                    },
                    function(response) {
                        vm.error = Utils.parseError(response, 'It was impossible to load the list of orders');
                        vm.list.status = ERROR;
                    }
                );
            }
        }

        $scope.$watch(function() {
            return vm.offset;
        }, productOrderSearch);

        function getElementsLength() {
            //var params = {};
            //angular.copy($state.params, params);
            //return ProductOrder.count(params);
            return Promise.resolve(10)
        }

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, PRODUCTORDER_STATUS);
        }

        function isTransitable(productOrderItem) {
            return (
                productOrderItem.state === PRODUCTORDER_STATUS.ACKNOWLEDGED ||
                productOrderItem.state === PRODUCTORDER_STATUS.INPROGRESS
            );
        }

        function getNextStatus(productOrderItem) {
            var index = PRODUCTORDER_LIFECYCLE.indexOf(productOrderItem.state);
            return index !== -1 && index + 1 !== PRODUCTORDER_LIFECYCLE.length
                ? PRODUCTORDER_LIFECYCLE[index + 1]
                : null;
        }

        function canCancel(productOrder) {
            return (
                productOrder.state === PRODUCTORDER_STATUS.INPROGRESS &&
                productOrder.productOrderItem.every(function(productOrderItem) {
                    return productOrderItem.state === PRODUCTORDER_STATUS.ACKNOWLEDGED;
                })
            );
        }

        function cancelOrder(productOrder) {
            var dataUpdated = {
                state: PRODUCTORDER_STATUS.CANCELLED
            };

            vm.cancellingOrder = true;

            ProductOrder.update(productOrder, dataUpdated).then(
                function(productOrderUpdated) {
                    angular.copy(productOrderUpdated, productOrder);
                    vm.cancellingOrder = false;

                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                        message: 'Your order has been cancelled'
                    });
                },
                function(response) {
                    var defaultMessage =
                        'There was an unexpected error that prevented the ' +
                        'system from updating the status of the given product order';
                    var error = Utils.parseError(response, defaultMessage);

                    vm.cancellingOrder = false;
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: error
                    });
                }
            );
        }

        function updateStatus(productOrder, index, status) {
            var dataUpdated = {
                productOrderItem: angular.copy(productOrder.productOrderItem)
            };

            dataUpdated.productOrderItem[index].state = status;
            dataUpdated.productOrderItem.forEach(function(productOrderItem) {
                productOrderItem.productOffering = productOrderItem.productOffering.serialize();
            });
            ProductOrder.update(productOrder, dataUpdated).then(
                function(productOrderUpdated) {
                    angular.copy(productOrderUpdated, productOrder);
                },
                function(response) {
                    var defaultMessage =
                        'There was an unexpected error that prevented the ' +
                        'system from updating the given product order';
                    var error = Utils.parseError(response, defaultMessage);

                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: error
                    });
                }
            );
        }
    }

    function ProductOrderCreateController(
        $state,
        $rootScope,
        $scope,
        $window,
        $interval,
        User,
        ProductOrder,
        Offering,
        ShoppingCart,
        Utils,
        EVENTS
    ) {
        /* jshint validthis: true */
        var vm = this;

        // Initialize order
        vm.orderInfo = {
            state: 'acknowledged',
            productOrderItem: [],
            relatedParty: [User.serializeBasic()],
            priority: '4'
        };

        vm.PRIORITIES = ProductOrder.TYPES.PRIORITY;

        vm.note = {
            text: ''
        };

        vm.makeOrder = makeOrder;
        vm.toggleCollapse = toggleCollapse;
        vm.createOrderStatus = INITIAL;
        vm.formatPriceplan = formatPriceplan;
        vm.setBillingAccount = setBillingAccount;

        function toggleCollapse(id) {
            $('#' + id).collapse('toggle');
        }

        function setBillingAccount(billingAccount) {
            vm.billingAccount = billingAccount;
        }

        $scope.$on(EVENTS.OFFERING_REMOVED, function() {
            initOrder();
        });

        const initOrder = function initOrder() {
            vm.loadingStatus = LOADING;
            vm.billingAccount = null;

            ShoppingCart.getItems().then(
                function(productOrderItems) {
                    vm.loadingStatus = LOADED;
                    vm.productOrderItems = productOrderItems;

                    if (productOrderItems.length) {
                        vm.orderInfo.relatedParty[0].role = 'Customer';

                        // Remove old order items
                        vm.orderInfo.productOrderItem = [];

                        // Build order items. This information is created using the shopping card and is not editable in this view
                        for (let i = 0; i < productOrderItems.length; i++) {
                            const item = {
                                id: `urn:ngsi-ld:product-order-item:${uuid.v4()}`,
                                action: 'add',
                                state: 'acknowledged',
                                productOffering: {
                                    id: productOrderItems[i].id,
                                    name: productOrderItems[i].name,
                                    href: productOrderItems[i].href
                                },
                                product: {
                                    productCharacteristic: []
                                },
                                //billingAccount: [User.serializeBasic()]
                            };

                            // Use pricing and characteristics to build the product property
                            if (productOrderItems[i].options.characteristics) {
                                for (let j = 0; j < productOrderItems[i].options.characteristics.length; j++) {
                                    var productChars = productOrderItems[i].options.characteristics[j];

                                    for (let k = 0; k < productChars.characteristics.length; k++) {
                                        var char = productChars.characteristics[k].characteristic;
                                        var selectedValue = productChars.characteristics[k].value;
                                        var value;

                                        if (
                                            char.valueType.toLowerCase() === 'string' ||
                                            (char.valueType.toLowerCase() === 'number' && selectedValue.value)
                                        ) {
                                            value = selectedValue.value;
                                        } else {
                                            value = selectedValue.valueFrom + '-' + selectedValue.valueTo;
                                        }

                                        var charIdName = '';
                                        if (productChars.offName) {
                                            charIdName = 'offering:' + productChars.offId + ' ';
                                        }
                                        if (productChars.id) {
                                            charIdName += 'product:' + productChars.id + ' ';
                                        }

                                        item.product.productCharacteristic.push({
                                            name: charIdName + char.name,
                                            value: value,
                                            valueType: char.valueType
                                        });
                                    }
                                }
                            }

                            if (productOrderItems[i].options.pricing) {
                                const price = productOrderItems[i].options.pricing;
                                price.price = {
                                    taxIncludedAmount: {
                                        value: productOrderItems[i].options.pricing.price.taxIncludedAmount,
                                        unit: productOrderItems[i].options.pricing.price.currencyCode
                                    },
                                    taxRate: productOrderItems[i].options.pricing.price.taxRate
                                };

                                if (angular.isObject(productOrderItems[i].pricePlan.priceAlteration())) {
                                    price.description =
                                        price.description + '\n' + productOrderItems[i].pricePlan.priceAlteration().format();
                                }

                                price.productOfferingPrice = {
                                    id: price.id,
                                    href: price.id
                                }

                                item.product.productPrice = [price];
                            }

                            // Include the item to the order
                            vm.orderInfo.productOrderItem.push(item);
                        }
                    } else {
                        $state.go('offering');
                        $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'info', {
                            message: 'No items found on your shopping cart!'
                        });
                    }
                },
                function(response) {
                    vm.error = Utils.parseError(response, 'It was impossible to load your shopping cart');
                    vm.loadingStatus = ERROR;
                }
            );
        };

        function formatPriceplan(productOrderItem) {
            var result, priceplan;

            if (angular.isArray(productOrderItem.product.productPrice) && productOrderItem.product.productPrice.length) {
                priceplan = productOrderItem.product.productPrice[0];
                result = priceplan.price.amount + ' ' + priceplan.price.currency;
                switch (priceplan.priceType) {
                    case Offering.TYPES.PRICE.RECURRING:
                        result += ' / ' + priceplan.recurringChargePeriod;
                        break;
                    case Offering.TYPES.PRICE.USAGE:
                        result += ' / ' + priceplan.unitOfMeasure;
                        break;
                }
            } else {
                result = 'Free';
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

            if (vm.note.text) {
                apiInfo['note'] = [
                    {
                        text: vm.note.text,
                        author: apiInfo.relatedParty[0].id,
                        date: new Date()
                    }
                ];
                vm.note.text = '';
            }

            apiInfo.billingAccount = vm.billingAccount.serialize()

            for (var i = 0; i < apiInfo.productOrderItem.length; i++) {
                delete apiInfo.productOrderItem[i].productOffering.name;
            }

            apiInfo.orderDate = new Date();
            apiInfo.notificationContact = vm.billingAccount.serializeEmailAddress();

            ProductOrder.create(apiInfo).then(
                function(orderCreated) {
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
                        $rootScope.$emit(
                            EVENTS.MESSAGE_CREATED,
                            orderCreated.headers['x-redirect-url'],
                            paymentFinished.bind(this, false)
                        );

                        if (ppalWindow) {
                            interval = $interval(function() {
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
                },
                function(response) {
                    vm.createOrderStatus = ERROR;

                    var defaultMessage =
                        'There was an unexpected error that prevented the ' + 'system from creating a new order';
                    var error = Utils.parseError(response, defaultMessage);

                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: error
                    });
                }
            );
        }

        initOrder();
    }

    function ProductOrderDetailController(
        $rootScope,
        $state,
        EVENTS,
        PROMISE_STATUS,
        PRODUCTORDER_STATUS,
        Utils,
        User,
        ProductOrder
    ) {
        /* jshint validthis: true */
        var vm = this;

        var notes;
        vm.STATUS = PROMISE_STATUS;

        vm.item = {};
        vm.comments = [];

        vm.createNote = createNote;
        vm.getCustomerName = getCustomerName;
        vm.getVendorName = getVendorName;
        vm.getShippingAddress = getShippingAddress;
        vm.can = can;
        vm.sendProduct = sendProduct;
        vm.rejectProduct = rejectProduct;
        vm.deliverProduct = deliverProduct;
        vm.cancel = cancel;

        ProductOrder.detail($state.params.productOrderId).then(
            function(productOrderRetrieved) {
                vm.item = productOrderRetrieved;
                vm.item.status = LOADED;
                vm.comments = createComments(vm.item.note);
                notes = vm.item.note;
            },
            function(response) {
                vm.error = Utils.parseError(response, 'The requested product order could not be retrieved');
                vm.item.status = ERROR;
            }
        );

        vm.note = {
            text: ''
        };

        var promises = {
            cancel: null,
            createNote: null,
            updateOrderItemStatus: null
        };

        Object.defineProperty(cancel, 'status', {
            get: function() {
                return promises.cancel ? promises.cancel.$$state.status : -1;
            }
        });

        Object.defineProperty(createNote, 'status', {
            get: function() {
                return promises.createNote ? promises.createNote.$$state.status : -1;
            }
        });

        Object.defineProperty(sendProduct, 'status', {
            get: function() {
                return promises.updateOrderItemStatus ? promises.updateOrderItemStatus.$$state.status : -1;
            }
        });

        Object.defineProperty(rejectProduct, 'status', {
            get: function() {
                return promises.updateOrderItemStatus ? promises.updateOrderItemStatus.$$state.status : -1;
            }
        });

        Object.defineProperty(deliverProduct, 'status', {
            get: function() {
                return promises.updateOrderItemStatus ? promises.updateOrderItemStatus.$$state.status : -1;
            }
        });

        function cancel() {
            var dataUpdated = {
                state: PRODUCTORDER_STATUS.CANCELLED
            };

            promises.cancel = ProductOrder.update(vm.item, dataUpdated).then(
                function(productOrderUpdated) {
                    $state.go(
                        'inventory.productOrder.detail',
                        {
                            catalogueId: productOrderUpdated.id
                        },
                        {
                            reload: true
                        }
                    );
                },
                function(response) {
                    var defaultMessage = "Unexpected error trying to update the order's status";
                    var error = Utils.parseError(response, defaultMessage);

                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: error
                    });
                }
            );
        }

        function sendProduct(index) {
            updateStatus(index, PRODUCTORDER_STATUS.INPROGRESS);
        }

        function rejectProduct(index) {
            updateStatus(index, PRODUCTORDER_STATUS.FAILED);
        }

        function deliverProduct(index) {
            updateStatus(index, PRODUCTORDER_STATUS.COMPLETED);
        }

        function updateStatus(index, status) {
            var dataUpdated = {
                productOrderItem: []
            };

            dataUpdated.productOrderItem = vm.item.productOrderItem.map(function(productOrderItem, index) {
                var data = angular.copy(productOrderItem);
                data.productOffering = productOrderItem.productOffering.serialize();
                data.billingAccount = [productOrderItem.billingAccount.serialize()];

                if (!productOrderItem.product.productCharacteristic.length) {
                    data.product.productCharacteristic = [{}];
                }

                if (index === index) {
                    data.state = status;
                }
                return data;
            });
            promises.updateOrderItemStatus = ProductOrder.update(vm.item, dataUpdated).then(
                function(productOrderUpdated) {
                    $state.go(
                        'inventory.productOrder.detail',
                        {
                            catalogueId: productOrderUpdated.id
                        },
                        {
                            reload: true
                        }
                    );
                },
                function(response) {
                    var defaultMessage = "Unexpected error trying to update the order item's status";
                    var error = Utils.parseError(response, defaultMessage);

                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: error
                    });
                }
            );
        }

        function can(permission, productOrderItem) {
            switch (permission) {
                case 'cancel':
                    return (
                        isCustomer() &&
                        vm.item.state === PRODUCTORDER_STATUS.INPROGRESS &&
                        vm.item.productOrderItem.every(function(productOrderItem) {
                            return productOrderItem.state === PRODUCTORDER_STATUS.ACKNOWLEDGED;
                        })
                    );
                case 'reject':
                    return (
                        isVendor(productOrderItem) &&
                        vm.item.state === PRODUCTORDER_STATUS.INPROGRESS &&
                        isTransitable(productOrderItem)
                    );
                case 'send':
                    return (
                        isVendor(productOrderItem) &&
                        vm.item.state === PRODUCTORDER_STATUS.INPROGRESS &&
                        isTransitable(productOrderItem) &&
                        productOrderItem.state === PRODUCTORDER_STATUS.ACKNOWLEDGED
                    );
                case 'deliver':
                    return (
                        isVendor(productOrderItem) &&
                        vm.item.state === PRODUCTORDER_STATUS.INPROGRESS &&
                        isTransitable(productOrderItem) &&
                        productOrderItem.state === PRODUCTORDER_STATUS.INPROGRESS
                    );
            }
        }

        function isCustomer() {
            return getCustomerName() === User.loggedUser.currentUser.id;
        }

        function isVendor(productOrderItem) {
            return getVendorName(productOrderItem) === User.loggedUser.currentUser.id;
        }

        function isTransitable(productOrderItem) {
            return (
                productOrderItem.state === PRODUCTORDER_STATUS.ACKNOWLEDGED ||
                productOrderItem.state === PRODUCTORDER_STATUS.INPROGRESS
            );
        }

        function getCustomerName() {
            var i;

            for (i = 0; i < vm.item.relatedParty.length; i++) {
                if (vm.item.relatedParty[i].role.toLowerCase() === 'customer') {
                    return vm.item.relatedParty[i].id;
                }
            }

            return null;
        }

        function getVendorName(productOrderItem) {
            var i;

            for (i = 0; i < productOrderItem.product.relatedParty.length; i++) {
                if (productOrderItem.product.relatedParty[i].role.toLowerCase() === 'seller') {
                    return productOrderItem.product.relatedParty[i].id;
                }
            }

            return null;
        }

        function getShippingAddress() {
            return vm.item.productOrderItem[0].billingAccount.getPostalAddress().toString();
        }

        function createComments(notes) {
            var comments = [];

            if (angular.isArray(notes) && notes.length) {
                notes.forEach(function(note) {
                    var comment;

                    if (!comments.length || comments[comments.length - 1].author !== note.author) {
                        comment = ProductOrder.Comment(note.author);
                        comments.push(comment);
                    } else {
                        comment = comments[comments.length - 1];
                    }

                    comment.appendNote(note.date, note.text);
                });
            }

            return comments;
        }

        function createNote() {
            var dataUpdated = {
                note: [
                    {
                        author: User.loggedUser.currentUser.partyId,
                        date: new Date(),
                        text: vm.note.text
                    }
                ].concat(notes)
            };

            promises.createNote = ProductOrder.update(vm.item, dataUpdated).then(
                function(productOrder) {
                    vm.note.text = '';
                    notes = productOrder.note;
                    vm.comments = createComments(productOrder.note);
                },
                function(response) {}
            );
        }
    }
})();
