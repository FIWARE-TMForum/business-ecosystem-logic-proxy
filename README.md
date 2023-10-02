# Business Ecosystem Logic Proxy

[![](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/data-monetization.svg)](https://www.fiware.org/developers/catalogue/)
[![License badge](https://img.shields.io/github/license/FIWARE-TMForum/Business-API-Ecosystem.svg)](https://opensource.org/licenses/AGPL-3.0)
[![](https://img.shields.io/badge/tag-fiware-orange.svg?logo=stackoverflow)](http://stackoverflow.com/questions/tagged/fiware)
[![Support](https://img.shields.io/badge/support-askbot-yellowgreen.svg)](https://ask.fiware.org)
<br>
[![Quay badge](https://img.shields.io/badge/quay.io-fiware%2Fbiz--ecosystem--logic--proxy-grey?logo=red%20hat&labelColor=EE0000)](https://quay.io/repository/fiware/biz-ecosystem-logic-proxy)
[![Docker badge](https://img.shields.io/badge/docker-fiware%2Fbiz--ecosystem--logic--proxy-blue?logo=docker)](https://registry.hub.docker.com/r/fiware/biz-ecosystem-logic-proxy)
<br>
[![Docs](https://img.shields.io/badge/docs-latest-brightgreen.svg?style=flat)](http://business-api-ecosystem.readthedocs.io/en/latest/)
[![Test Status](https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy/actions/workflows/test.yml/badge.svg)](https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy/actions/workflows/test.yml)
[![Coverage Status](https://coveralls.io/repos/github/FIWARE-TMForum/business-ecosystem-logic-proxy/badge.svg?branch=master)](https://coveralls.io/github/FIWARE-TMForum/business-ecosystem-logic-proxy?branch=master)

 * [Introduction](#introduction)
 * [GEi Overall Description](#gei-overall-description)
 * [Installation](#installation)
 * [API Reference](#api-reference)
 * [Testing](#testing)
 * [Advanced Topics](#advanced-topics)

# Introduction

This is the code repository for the Business Ecosystem Logic Proxy, one of the components that made up the [Business API Ecosystem GE](https://github.com/FIWARE-TMForum/Business-API-Ecosystem). The Business API Ecosystem is part of [FIWARE](https://www.fiware.org), and has been developed in collaboration with the [TM Forum](https://www.tmforum.org/).

Any feedback is highly welcome, including bugs, typos or things you think should be included but aren't. You can use [GitHub Issues](https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy/issues/new) to provide feedback.

| :books: [Documentation](http://business-api-ecosystem.readthedocs.io) | :whale: [Docker](https://registry.hub.docker.com/r/fiware/biz-ecosystem-logic-proxy) | <img style="height:1em" src="https://quay.io/static/img/quay_favicon.png"/> [quay.io](https://quay.io/repository/fiware/biz-ecosystem-logic-proxy) |
 | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | --- |

# GEi Overall Description

The Business API Ecosystem is a joint component made up of the FIWARE Business Framework and a set of APIs (and its reference implementations) provided by the TMForum. This component allows the monetization of different kind of assets (both digital and physical) during the whole service life cycle, from offering creation to its charging, accounting and revenue settlement and sharing. The Business API Ecosystem exposes its complete functionality through TMForum standard APIs; concretely, it includes the catalog management, ordering management, inventory management, usage management, billing, customer, and party APIs.

In this context, the Business Ecosystem Logic Proxy acts as the endpoint for accessing the Business API Ecosystem. On the one hand, it orchestrates the APIs validating user requests, including authentication, authorization, and the content of the request from a business logic point of view. On the other hand, it serves a web portal that can be used to interact with the system.

# Installation

The Business Ecosystem Logic Proxy is installed as part of the Business API Ecosystem, so the instructions to install it can be found at [the Business API Ecosystem Installation Guide](http://business-api-ecosystem.readthedocs.io/en/latest/installation-administration-guide.html). You can install the software in two different ways:

* Using a [Docker Container](https://hub.docker.com/r/fiware/biz-ecosystem-logic-proxy/) (recommended)
* Manually

# API Reference

For further documentation, you can check the API Reference available at:

* [Apiary](http://docs.fiwaretmfbizecosystem.apiary.io)
* [GitHub Pages](https://fiware-tmforum.github.io/Business-API-Ecosystem/)

# Testing

To execute the unit tests, just run:

```
npm test
```

## Advanced Topics

* [User & Programmers Guide](https://github.com/FIWARE-TMForum/Business-API-Ecosystem/blob/master/doc/user-programmer-guide.rst)
* [Installation & Administration Guide](https://github.com/FIWARE-TMForum/Business-API-Ecosystem/blob/master/doc/installation-administration-guide.rst)

You can also find this documentation on [ReadTheDocs](http://business-api-ecosystem.readthedocs.io)


