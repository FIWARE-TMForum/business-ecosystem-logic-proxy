/* Copyright (c) 2026 Future Internet Consulting and Development Solutions S.L.
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

describe('Config TMForum global endpoint overrides', () => {
    const CONFIG_PATH = '../../config';
    const CONFIG_RESOLVED_PATH = require.resolve(CONFIG_PATH);
    const ENV_KEYS = [
        'BAE_LP_ENDPOINT_TMFORUM_HOST',
        'BAE_LP_ENDPOINT_TMFORUM_PORT',
        'BAE_LP_ENDPOINT_TMFORUM_SECURED',
        'BAE_LP_ENDPOINT_CATALOG_HOST',
        'BAE_LP_ENDPOINT_CATALOG_PORT',
        'BAE_LP_ENDPOINT_CATALOG_SECURED'
    ];
    let originalEnv;

    const loadConfig = () => {
        delete require.cache[CONFIG_RESOLVED_PATH];
        return require(CONFIG_PATH);
    };

    beforeEach(() => {
        originalEnv = {};

        ENV_KEYS.forEach((key) => {
            originalEnv[key] = process.env[key];
            delete process.env[key];
        });
    });

    afterEach(() => {
        ENV_KEYS.forEach((key) => {
            if (originalEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = originalEnv[key];
            }
        });

        delete require.cache[CONFIG_RESOLVED_PATH];
    });

    it('should apply global host, port and secured to every TMForum API', () => {
        process.env.BAE_LP_ENDPOINT_TMFORUM_HOST = 'tmforum.example.com';
        process.env.BAE_LP_ENDPOINT_TMFORUM_PORT = '9443';
        process.env.BAE_LP_ENDPOINT_TMFORUM_SECURED = 'true';

        const config = loadConfig();

        Object.keys(config.tmforum).forEach((apiName) => {
            expect(config.tmforum[apiName].host).toEqual('tmforum.example.com');
            expect(config.tmforum[apiName].port).toEqual('9443');
            expect(config.tmforum[apiName].appSsl).toEqual(true);
        });
    });

    it('should let API-specific variables override global TMForum variables', () => {
        process.env.BAE_LP_ENDPOINT_TMFORUM_HOST = 'tmforum.example.com';
        process.env.BAE_LP_ENDPOINT_TMFORUM_PORT = '9443';
        process.env.BAE_LP_ENDPOINT_TMFORUM_SECURED = 'false';

        process.env.BAE_LP_ENDPOINT_CATALOG_HOST = 'catalog.example.com';
        process.env.BAE_LP_ENDPOINT_CATALOG_PORT = '8080';
        process.env.BAE_LP_ENDPOINT_CATALOG_SECURED = 'true';

        const config = loadConfig();

        expect(config.tmforum.catalog.host).toEqual('catalog.example.com');
        expect(config.tmforum.catalog.port).toEqual('8080');
        expect(config.tmforum.catalog.appSsl).toEqual(true);

        expect(config.tmforum.ordering.host).toEqual('tmforum.example.com');
        expect(config.tmforum.ordering.port).toEqual('9443');
        expect(config.tmforum.ordering.appSsl).toEqual(false);
    });
});
