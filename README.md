#Business Ecosystem

+ [Introduction](#def-introduction)
+ [How to Build & Install](#def-build)
    - [Docker](#def-docker)
+ [API Overview](#def-api)
+ [Advanced documentation](#def-advanced)
+ [License](#def-license)

---

<br>

<a name="def-introduction"></a>
## Introduction

This project is part of [FIWARE](http://fiware.org). You will find more information about this FIWARE GE [here](http://catalogue.fiware.org/enablers/pep-proxy-wilma).

- You will find the source code of this project in GitHub [here](https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy)
- You will find the documentation of this project in Read the Docs [here](http://fiware-pep-proxy.readthedocs.org/)

This component handles the request to the TMForum APIs and applies a business logic layer so only certain users are allowed to perform certain operations. Additionally, this component offers a graphical user interface that can be used by end-users to access this set of APIs in a simpler way (without having REST knowledge).

<a name="def-build"></a>
## How to Build & Install

- Software requirements:

	+ nodejs 
	+ npm
	Note: Both can be installed from (http://nodejs.org/download/)

- Clone Proxy repository:

```
git clone https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy
```

- Install the dependencies:

```
cd business-ecosystem-logic-proxy/
npm install
```

- Duplicate config.template in config.js and configure the service by setting the empty fields. 

- Start proxy server

```
sudo node server
```

<a name="def-docker"></a>
### Docker

TO BE DONE

<a name="def-api"></a>
## API Overview

Requests to proxy should be made with a special HTTP Header: Authorization.
This header contains the OAuth access token obtained from FIWARE IDM GE.

Example of request:

```
GET / HTTP/1.1
Host: proxy_host
Authorization: Bearer z2zXk...ANOXvZrmvxvSg
```

To test the proxy you can generate this request running the following command:

```
curl --header "Authorization: Bearer z2zXk...ANOXvZrmvxvSg" http://proxy_host
```

Once authenticated, the forwarded request will include additional HTTP headers with user info:

```
X-Nick-Name: nickname of the user in IdM
X-Display-Name: display name of user in IdM
X-Roles: roles of the user in IdM
X-Organizations: organizations in IdM
```

<a name="def-advanced"></a>
## Advanced Documentation

TO BE DONE

<a name="def-license"></a>
## License

The MIT License

Copyright (C) 2012 Universidad Politécnica de Madrid.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

