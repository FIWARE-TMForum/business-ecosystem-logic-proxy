(function () {

    'use strict';

    angular
        .module('app')
        .controller('CreateOrderCtrl', CreateOrderController);

    function CreateOrderController($rootScope, $state, Order, User, ShoppingCart, $window, $interval, EVENTS) {
        var vm = this;

        vm.makeOrder = makeOrder;

        var initOrder = function initOrder() {
            var orderItems = ShoppingCart.getItems();

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
        };

        function makeOrder() {
            // Fix display fields to accommodate API restrictions
            for (var i = 0; i < vm.orderInfo.orderItem.length; i++) {
                delete vm.orderInfo.orderItem[i].productOffering.name;
                if (!vm.orderInfo.orderItem[i].product.productCharacteristic.length) {
                    vm.orderInfo.orderItem[i].product.productCharacteristic.push({});
                }
            }

            Order.create(vm.orderInfo).then(function(orderCreated) {
                if ('x-redirect-url' in orderCreated.headers) {
                    var ppalWindow = $window.open(orderCreated.headers['x-redirect-url'], '_blank');

                    // Display a message and wait until the new tab has been closed to redirect the page
                    $rootScope.$emit(EVENTS.MESSAGE_CREATED);
                    var interval = $interval(function() {
                        if (ppalWindow.closed) {
                            $interval.cancel(interval);
                            $rootScope.$emit(EVENTS.MESSAGE_CLOSED);
                            ShoppingCart.cleanItems();
                            $state.go('inventory.order');
                        }
                    }, 500);

                } else {
                    ShoppingCart.cleanItems();
                    $state.go('inventory.order');
                }
            });
        }

        initOrder();
    }
})();
