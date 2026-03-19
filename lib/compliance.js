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

const axios = require('axios');
const path = require('path');
const FormData = require('form-data');

const config = require('../config');
const utils = require('./utils');
const partyClient = require('./party').partyClient;
const logger = require('./logger').logger.getLogger('Compliance');

const CERTIFICATE_PATH = '/api/v1/productoffering/certificate';

const complianceClient = (function() {
    const serializeForLog = function(value) {
        try {
            return JSON.stringify(value);
        } catch (_) {
            return String(value);
        }
    };

    const makeError = function(status, message, body) {
        return {
            status: status,
            message: message,
            body: body
        };
    };

    const findRelatedPartyByRole = function(productSpecification, roleName) {
        if (!productSpecification || !Array.isArray(productSpecification.relatedParty)) {
            logger.debug('findRelatedPartyByRole: productSpecification.relatedParty is missing or invalid');
            return null;
        }

        logger.debug(
            `findRelatedPartyByRole: searching role=${roleName}, relatedPartyCount=${productSpecification.relatedParty.length}`
        );
        return productSpecification.relatedParty.find((partyRef) => {
            return (
                typeof partyRef.role === 'string' &&
                partyRef.role.toLowerCase() === roleName.toLowerCase()
            );
        });
    };

    const getPartyCharacteristicValue = function(party, characteristicName) {
        if (!party || !Array.isArray(party.partyCharacteristic)) {
            logger.debug(`getPartyCharacteristicValue: no partyCharacteristic for ${characteristicName}`);
            return '';
        }

        const partyCharacteristic = party.partyCharacteristic.find((characteristic) => {
            return (
                characteristic &&
                typeof characteristic.name === 'string' &&
                characteristic.name.toLowerCase() === characteristicName.toLowerCase()
            );
        });

        logger.debug(
            `getPartyCharacteristicValue: characteristic=${characteristicName}, found=${!!partyCharacteristic}`
        );
        return partyCharacteristic && partyCharacteristic.value ? String(partyCharacteristic.value) : '';
    };

    const getOrganizationEmail = function(organization) {
        if (organization && Array.isArray(organization.contactMedium)) {
            logger.debug(`getOrganizationEmail: contactMedium count=${organization.contactMedium.length}`);
            const email = organization.contactMedium.find((medium) => {
                const mediumType = medium && medium.mediumType ? medium.mediumType.toLowerCase() : '';

                return (
                    medium.characteristic &&
                    medium.characteristic.emailAddress &&
                    mediumType === 'email'
                );
            });

            if (email && email.characteristic && email.characteristic.emailAddress) {
                logger.debug(`getOrganizationEmail: selected email=${email.characteristic.emailAddress}`);
                return email.characteristic.emailAddress;
            }
        }

        const fallbackEmail = organization && (organization.emailAddress || organization.email)
            ? organization.emailAddress || organization.email
            : '';
        logger.debug(`getOrganizationEmail: fallback email=${fallbackEmail || 'empty'}`);
        return fallbackEmail;
    };

    const getOrganizationPostalAddress = function(organization) {
        if (!organization || !Array.isArray(organization.contactMedium)) {
            logger.debug('getOrganizationPostalAddress: contactMedium is missing');
            return null;
        }

        logger.debug(`getOrganizationPostalAddress: evaluating ${organization.contactMedium.length} contact mediums`);
        const postalAddress = organization.contactMedium.find((medium) => {
            const mediumType = medium && medium.mediumType ? medium.mediumType.toLowerCase() : '';
            return medium.characteristic && mediumType === 'postaladdress';
        });

        logger.debug(`getOrganizationPostalAddress: found=${!!postalAddress}`);
        return postalAddress && postalAddress.characteristic ? postalAddress.characteristic : null;
    };

    const getOrganizationAddress = function(organization) {
        const address = getOrganizationPostalAddress(organization);

        if (!address) {
            return '';
        }

        const fields = [
            address.street1 || address.street || '',
            address.street2 || '',
            address.postCode || '',
            address.city || '',
            address.stateOrProvince || '',
            address.country || ''
        ].filter((part) => {
            return part && String(part).trim().length > 0;
        });

        const finalAddress = fields.join(', ');
        logger.debug(`getOrganizationAddress: address=${finalAddress || 'empty'}`);
        return finalAddress;
    };

    const getOrganizationCountry = function(organization) {
        const normalizeCountryCode = function(countryValue) {
            if (!countryValue) {
                return '';
            }

            const normalized = utils.normalizeCountry(String(countryValue).trim());
            if (normalized && normalized.length === 2) {
                logger.debug(`normalizeCountryCode: raw=${countryValue}, normalized=${normalized.toUpperCase()}`);
                return normalized.toUpperCase();
            }

            logger.debug(`normalizeCountryCode: raw=${countryValue}, normalized=empty`);
            return '';
        };

        const characteristicCountry = normalizeCountryCode(getPartyCharacteristicValue(organization, 'country'));
        if (characteristicCountry) {
            logger.debug(`getOrganizationCountry: using partyCharacteristic country=${characteristicCountry}`);
            return characteristicCountry;
        }

        const address = getOrganizationPostalAddress(organization);
        const countryFromAddress = normalizeCountryCode(address && address.country ? String(address.country) : '');
        logger.debug(`getOrganizationCountry: using postal address country=${countryFromAddress || 'empty'}`);
        return countryFromAddress;
    };

    const getOrganizationVat = function(organization) {
        if (organization && Array.isArray(organization.externalReference)) {
            logger.debug(`getOrganizationVat: externalReference count=${organization.externalReference.length}`);
            const externalReference = organization.externalReference.find((ref) => {
                return (
                    ref &&
                    ref.name &&
                    typeof ref.externalReferenceType === 'string' &&
                    ref.externalReferenceType.toLowerCase() === 'idm_id'
                );
            });

            if (externalReference) {
                logger.debug(`getOrganizationVat: VAT found in externalReference idm_id=${externalReference.name}`);
                return externalReference.name;
            }
        }

        if (organization && Array.isArray(organization.organizationIdentification)) {
            logger.debug(
                `getOrganizationVat: trying fallback organizationIdentification count=${organization.organizationIdentification.length}`
            );
            const orgIdentifier = organization.organizationIdentification.find((identifier) => {
                return identifier && identifier.identificationId;
            });

            if (orgIdentifier) {
                logger.debug(
                    `getOrganizationVat: VAT found in organizationIdentification=${orgIdentifier.identificationId}`
                );
                return orgIdentifier.identificationId;
            }
        }

        logger.debug('getOrganizationVat: VAT not found');
        return '';
    };

    const getBaseUrl = function() {
        if (!config.complianceServerUrl || config.complianceServerUrl.trim().length === 0) {
            throw makeError(500, 'Compliance server URL is not configured', null);
        }

        const normalizedBaseUrl = config.complianceServerUrl.replace(/\/+$/, '');
        logger.debug(`getBaseUrl: normalizedBaseUrl=${normalizedBaseUrl}`);
        return normalizedBaseUrl;
    };

    const buildFilenameFromUrl = function(fileUrl, index) {
        try {
            const parsed = new URL(fileUrl);
            const filename = path.basename(parsed.pathname);
            logger.debug(`buildFilenameFromUrl: fileUrl=${fileUrl}, filename=${filename}`);
            return filename || `compliance-file-${index + 1}`;
        } catch (_) {
            logger.debug(`buildFilenameFromUrl: invalid URL, using fallback index=${index}`);
            return `compliance-file-${index + 1}`;
        }
    };

    const appendFilePart = async function(form, fileUrl, index) {
        if (!fileUrl || typeof fileUrl !== 'string' || fileUrl.trim().length === 0) {
            return;
        }

        const filename = buildFilenameFromUrl(fileUrl, index);
        logger.debug(`Downloading compliance file: ${filename}`);

        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const contentType = response.headers && response.headers['content-type']
            ? response.headers['content-type']
            : 'application/octet-stream';
        const responseSize = response.data ? Buffer.byteLength(Buffer.from(response.data)) : 0;
        logger.debug(`Downloaded compliance file: ${filename}, contentType=${contentType}, bytes=${responseSize}`);

        form.append('files', Buffer.from(response.data), {
            filename: filename,
            contentType: contentType
        });
    };

    const getComplianceFileUrls = function(productSpecification) {
        if (!productSpecification || !Array.isArray(productSpecification.productSpecCharacteristic)) {
            return [];
        }

        const fileUrls = [];

        productSpecification.productSpecCharacteristic.forEach((characteristic) => {
            if (!characteristic || typeof characteristic.name !== 'string') {
                return;
            }

            const characteristicName = characteristic.name.toLowerCase();
            logger.debug(`getComplianceFileUrls: evaluating characteristic=${characteristic.name}`);
            if (!characteristicName.startsWith('compliance:') || characteristicName === 'compliance:vc') {
                logger.debug(`getComplianceFileUrls: skipped characteristic=${characteristic.name}`);
                return;
            }

            if (!Array.isArray(characteristic.productSpecCharacteristicValue)) {
                logger.debug(
                    `getComplianceFileUrls: characteristic has no values name=${characteristic.name}`
                );
                return;
            }

            characteristic.productSpecCharacteristicValue.forEach((characteristicValue) => {
                if (
                    characteristicValue &&
                    typeof characteristicValue.value === 'string' &&
                    characteristicValue.value.trim().length > 0
                ) {
                    fileUrls.push(characteristicValue.value.trim());
                    logger.debug(
                        `getComplianceFileUrls: added URL from ${characteristic.name} -> ${characteristicValue.value.trim()}`
                    );
                }
            });
        });

        logger.debug(`getComplianceFileUrls: total collected URLs=${fileUrls.length}`);
        return fileUrls;
    };

    const appendComplianceFiles = async function(form, productSpecification) {
        const fileUrls = getComplianceFileUrls(productSpecification);
        logger.info(`Compliance files detected: ${fileUrls.length}`);
        for (let i = 0; i < fileUrls.length; i++) {
            await appendFilePart(form, fileUrls[i], i);
        }
    };

    const buildFormPayload = async function(productSpecification, organization) {
        const form = new FormData();

        form.append('product_specification_id', productSpecification.id || '');
        form.append('service_name', productSpecification.name || '');
        form.append('service_version', productSpecification.version || '');
        form.append('organization_name', organization.tradingName || organization.name || '');

        form.append('organization_address', getOrganizationAddress(organization));
        form.append('organization_country', getOrganizationCountry(organization));
        form.append('organization_email', getOrganizationEmail(organization));
        form.append('organization_url', getPartyCharacteristicValue(organization, 'website'));
        form.append('organization_vat_id', getOrganizationVat(organization));
        form.append('requested_compliance_level', 'Baseline');
        logger.debug(
            `buildFormPayload: fields summary productId=${productSpecification.id || ''}, serviceName=${productSpecification.name || ''}, serviceVersion=${productSpecification.version || ''}, organizationName=${organization.tradingName || organization.name || ''}`
        );

        await appendComplianceFiles(form, productSpecification);

        return form;
    };

    const requestProductOfferingCertificate = async function(productSpecification, accessToken) {
        logger.info(`Starting compliance certificate request for product specification: ${productSpecification && productSpecification.id ? productSpecification.id : 'unknown'}`);
        logger.debug(
            `requestProductOfferingCertificate: hasAccessToken=${!!accessToken}, characteristicCount=${productSpecification && Array.isArray(productSpecification.productSpecCharacteristic) ? productSpecification.productSpecCharacteristic.length : 0}, relatedPartyCount=${productSpecification && Array.isArray(productSpecification.relatedParty) ? productSpecification.relatedParty.length : 0}`
        );

        if (!productSpecification || typeof productSpecification !== 'object') {
            throw makeError(400, 'Invalid product specification', null);
        }

        const seller = findRelatedPartyByRole(productSpecification, config.roles.seller);
        if (!seller || !seller.id) {
            throw makeError(400, `Missing related party with role ${config.roles.seller}`, null);
        }
        logger.debug(`Seller related party found: ${seller.id}`);

        let sellerOrganization;
        try {
            const organizationResp = await partyClient.getOrganization(seller.id);
            sellerOrganization = organizationResp.body;
            logger.debug(`Seller organization loaded: ${sellerOrganization && sellerOrganization.tradingName ? sellerOrganization.tradingName : seller.id}`);
        } catch (err) {
            logger.error(`Error loading seller organization from Party API: ${err.message}`);
            throw makeError(
                err && err.status ? err.status : 500,
                err && err.message
                    ? err.message
                    : 'Unable to retrieve seller related party from Party API',
                err && err.body ? err.body : null
            );
        }

        const baseUrl = getBaseUrl();
        let form;
        try {
            logger.debug('Building multipart payload for compliance request');
            form = await buildFormPayload(productSpecification, sellerOrganization || {});
            logger.debug('Multipart payload generated');
        } catch (err) {
            logger.error(`Error building multipart payload: ${err && err.message ? err.message : 'unknown error'}`);
            if (err && err.response) {
                const status = err.response.status;
                const body = err.response.data;
                let message = 'Error generating compliance form payload';
                if (body && body.error) {
                    message = body.error;
                }

                throw makeError(status, message, body);
            }

            if (err && err.status && err.message) {
                throw err;
            }

            throw makeError(502, 'Error generating compliance form payload', null);
        }

        const headers = form.getHeaders();

        const bearerToken = accessToken;
        if (bearerToken) {
            headers.Authorization = `Bearer ${bearerToken}`;
        }
        logger.debug(
            `requestProductOfferingCertificate: request headers keys=${serializeForLog(Object.keys(headers))}`
        );

        const requestOptions = {
            url: `${baseUrl}${CERTIFICATE_PATH}`,
            method: 'POST',
            headers: headers,
            data: form,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        };

        logger.info(`Sending compliance request to ${requestOptions.url}`);
        try {
            const response = await axios.request(requestOptions);
            logger.info(`Compliance request completed with status ${response.status}`);
            return {
                status: response.status,
                headers: response.headers,
                body: response.data
            };
        } catch (err) {
            if (err.response) {
                const status = err.response.status;
                const body = err.response.data;
                let message = 'Compliance server request failed';
                if (body && body.error) {
                    message = body.error;
                }

                logger.error(`Compliance server responded with error status ${status}: ${message}`);
                logger.debug(`Compliance server error body: ${serializeForLog(body)}`);
                throw makeError(status, message, body);
            }

            if (err.status && err.message) {
                logger.error(`Compliance request failed: ${err.message}`);
                throw err;
            }

            logger.error('Compliance server unreachable');
            throw makeError(504, 'Compliance server unreachable', null);
        }
    };

    return {
        requestProductOfferingCertificate: requestProductOfferingCertificate
    };
})();

exports.complianceClient = complianceClient;
