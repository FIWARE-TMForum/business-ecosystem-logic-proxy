# Business Ecosystem Logic Proxy

[![](https://img.shields.io/badge/FIWARE-Data_Monetization-51b6a3.svg?label=FIWARE&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABsAAAAVCAYAAAC33pUlAAAABHNCSVQICAgIfAhkiAAAA8NJREFUSEuVlUtIFlEUx+eO+j3Uz8wSLLJ3pBiBUljRu1WLCAKXbXpQEUFERSQF0aKVFAUVrSJalNXGgmphFEhQiZEIPQwKLbEUK7VvZrRvbr8zzjfNl4/swplz7rn/8z/33HtmRhn/MWzbXmloHVeG0a+VSmAXorXS+oehVD9+0zDN9mgk8n0sWtYnHo5tT9daH4BsM+THQC8naK02jCZ83/HlKaVSzBey1sm8BP9nnUpdjOfl/Qyzj5ust6cnO5FItJLoJqB6yJ4QuNcjVOohegpihshS4F6S7DTVVlNtFFxzNBa7kcaEwUGcbVnH8xOJD67WG9n1NILuKtOsQG9FngOc+lciic1iQ8uQGhJ1kVAKKXUs60RoQ5km93IfaREvuoFj7PZsy9rGXE9G/NhBsDOJ63Acp1J82eFU7OIVO1OxWGwpSU5hb0GqfMydMHYSdiMVnncNY5Vy3VbwRUEydvEaRxmAOSSqJMlJISTxS9YWTYLcg3B253xsPkc5lXk3XLlwrPLuDPKDqDIutzYaj3eweMkPeCCahO3+fEIF8SfLtg/5oI3Mh0ylKM4YRBaYzuBgPuRnBYD3mmhA1X5Aka8NKl4nNz7BaKTzSgsLCzWbvyo4eK9r15WwLKRAmmCXXDoA1kaG2F4jWFbgkxUnlcrB/xj5iHxFPiBN4JekY4nZ6ccOiQ87hgwhe+TOdogT1nfpgEDTvYAucIwHxBfNyhpGrR+F8x00WD33VCNTOr/Wd+9C51Ben7S0ZJUq3qZJ2OkZz+cL87ZfWuePlwRcHZjeUMxFwTrJZAJfSvyWZc1VgORTY8rBcubetdiOk+CO+jPOcCRTF+oZ0okUIyuQeSNL/lPrulg8flhmJHmE2gBpE9xrJNkwpN4rQIIyujGoELCQz8ggG38iGzjKkXufJ2Klun1iu65bnJub2yut3xbEK3UvsDEInCmvA6YjMeE1bCn8F9JBe1eAnS2JksmkIlEDfi8R46kkEkMWdqOv+AvS9rcp2bvk8OAESvgox7h4aWNMLd32jSMLvuwDAwORSE7Oe3ZRKrFwvYGrPOBJ2nZ20Op/mqKNzgraOTPt6Bnx5citUINIczX/jUw3xGL2+ia8KAvsvp0ePoL5hXkXO5YvQYSFAiqcJX8E/gyX8QUvv8eh9XUq3h7mE9tLJoNKqnhHXmCO+dtJ4ybSkH1jc9XRaHTMz1tATBe2UEkeAdKu/zWIkUbZxD+veLxEQhhUFmbnvOezsJrk+zmqMo6vIL2OXzPvQ8v7dgtpoQnkF/LP8Ruu9zXdJHg4igAAAABJRU5ErkJgggA=)](https://www.fiware.org/developers/catalogue/)
[![License badge](https://img.shields.io/github/license/FIWARE-TMForum/Business-API-Ecosystem.svg)](https://opensource.org/licenses/AGPL-3.0) [![Docs](https://img.shields.io/badge/docs-latest-brightgreen.svg?style=flat)](http://business-api-ecosystem.readthedocs.io/en/latest/) [![Docker](https://img.shields.io/docker/pulls/fiware/biz-ecosystem-logic-proxy.svg)](https://hub.docker.com/r/fiware/biz-ecosystem-logic-proxy) [![](https://img.shields.io/badge/tag-fiware-orange.svg?logo=stackoverflow)](http://stackoverflow.com/questions/tagged/fiware) [![Support](https://img.shields.io/badge/support-askbot-yellowgreen.svg)](https://ask.fiware.org) [![Test Status](https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy/actions/workflows/test.yml/badge.svg)](https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy/actions/workflows/test.yml)
[![Coverage Status](https://coveralls.io/repos/github/FIWARE-TMForum/business-ecosystem-logic-proxy/badge.svg?branch=master)](https://coveralls.io/github/FIWARE-TMForum/business-ecosystem-logic-proxy?branch=master)

 * [Introduction](#introduction)
 * [GEi Overall Description](#gei-overall-description)
 * [Installation](#build-and-install)
 * [API Reference](#api-reference)
 * [Testing](#testing)
 * [Advanced Topics](#advanced-topics)

# Introduction

This is the code repository for the Business Ecosystem Logic Proxy, one of the components that made up the [Business API Ecosystem GE](https://github.com/FIWARE-TMForum/Business-API-Ecosystem). The Business API Ecosystem is part of [FIWARE](https://www.fiware.org), and has been developed in collaboration with the [TM Forum](https://www.tmforum.org/).

Any feedback is highly welcome, including bugs, typos or things you think should be included but aren't. You can use [GitHub Issues](https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy/issues/new) to provide feedback.

# GEi Overal Description

The Business API Ecosystem is a joint component made up of the FIWARE Business Framework and a set of APIs (and its reference implementations) defined by the TMForum. This component allows the monetization of different kind of assets (both digital and physical) during the whole service life cycle, from offering creation to its charging, accounting and revenue settlement and sharing. The Business API Ecosystem exposes its complete functionality through TMForum standard APIs; in particular, it includes the catalog, management, ordering management, inventory management, usage management, billing, customer, and party APIs.

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


