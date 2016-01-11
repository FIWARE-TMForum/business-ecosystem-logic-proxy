/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app', ['ngResource', 'ngMessages', 'angularMoment', 'ui.router'])
        .constant('EVENTS', {
            FILTERS_OPENED: '$eventFiltersOpened',
            MESSAGE_ADDED: '$eventMessageAdded',
            PROFILE_OPENED: '$eventProfileOpened',
            OFFERING_ORDERED: '$eventOfferingOrdered',
            OFFERING_CONFIGURED: '$eventOfferingConfigured',
            OFFERING_REMOVED: '$eventOfferingRemoved'
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
        .constant('FILTER_STATUS', [
            {value: 'Active'},
            {value: 'Launched'},
            {value: 'Retired'},
            {value: 'Obsolete'}
        ]);

})();
