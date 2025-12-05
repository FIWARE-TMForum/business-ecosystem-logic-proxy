/* Copyright (c) 2025 Future Internet Consulting and Development Solutions S.L.
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

const cron = require('node-cron')
const logger = require('./logger').logger.getLogger('TMF')

const partyClient = require('../lib/party').partyClient;


const LRU = require('lru-cache');

const options = {
	max: 1
}
const cache = new LRU(options);
const key = 'operator:id';

const operator = (function() {
    const loadOperator = async function() {
        const operator = await partyClient.getOperatorParty();
        let operatorId = ''
        if (operator) {
            operatorId = operator.id
        }

        // Save data in MongoDB
        cache.set(key, operatorId);
    }

    const getOperatorId = function() {
        return cache.get(key);
    }

    const initOperator = function() {
        return loadOperator()
        .catch((err) => {
            console.log(err)
            logger.error('Operator could not be loaded')
        })
        .finally(() => {
            cron.schedule('0 4 * * *', loadOperator);
        })
    }
    return {
		initOperator: initOperator,
        getOperatorId: getOperatorId
	};
})();

exports.operator = operator;