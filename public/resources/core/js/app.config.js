/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    var PRODUCTORDER_STATUS = {
        ACKNOWLEDGED: 'Acknowledged',
        INPROGRESS: 'InProgress',
        COMPLETED: 'Completed',
        FAILED: 'Failed'
    };

    angular
        .module('app', ['ngResource', 'ngMessages', 'angularMoment', 'ui.router'])
        .constant('EVENTS', {
            FILTERS_OPENED: '$eventFiltersOpened',
            MESSAGE_ADDED: '$eventMessageAdded',
            PROFILE_OPENED: '$eventProfileOpened',
            OFFERING_ORDERED: '$eventOfferingOrdered',
            OFFERING_CONFIGURED: '$eventOfferingConfigured',
            OFFERING_REMOVED: '$eventOfferingRemoved',
            ORDER_CREATED: '$eventOrderCreated',
            MESSAGE_CREATED: '$eventMessageCreated',
            MESSAGE_CLOSED: '$eventMessageClosed',
            ORDERING_COMPLETED: '$eventOrderingCompleted'
        })
        .constant('PARTY_ROLES', {
            OWNER: 'Owner',
            SELLER: 'Seller'
        })
        .constant('LIFECYCLE_STATUS', {
            ACTIVE: 'Active',
            LAUNCHED: 'Launched',
            RETIRED: 'Retired',
            OBSOLETE: 'Obsolete'
        })
        .constant('INVENTORY_STATUS', {
            CREATED: 'Created',
            ACTIVE: 'Active',
            SUSPENDED: 'Suspended',
            TERMINATED: 'Terminated'
        })
        .constant('PRODUCTORDER_STATUS', PRODUCTORDER_STATUS)
        .constant('PRODUCTORDER_LIFECYCLE', [
            PRODUCTORDER_STATUS.ACKNOWLEDGED,
            PRODUCTORDER_STATUS.INPROGRESS,
            PRODUCTORDER_STATUS.COMPLETED
        ])
        .constant('FILTER_STATUS', [
            {value: 'Active'},
            {value: 'Launched'},
            {value: 'Retired'},
            {value: 'Obsolete'}
        ]);

})();
