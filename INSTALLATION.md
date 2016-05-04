# Installation

## TMForum APIs

| API | Location | Branch | Context Root |
|---|---|---|---|
| Product Catalog | https://github.com/FIWARE-TMForum/DSPRODUCTCATALOG2 | `master` | `DSProductCatalog` |
| Product Ordering | https://github.com/FIWARE-TMForum/DSPRODUCTORDERING | `develop` | `DSProductOrdering` |
| Product Inventory | https://github.com/FIWARE-TMForum/DSPRODUCTINVENTORY | `develop` | `DSProductInventory` |
| Party | https://github.com/FIWARE-TMForum/DSPARTYMANAGEMENT | `develop` | `DSPartyManagement` |
| Billing | https://github.com/FIWARE-TMForum/DSBILLINGMANAGEMENT | `develop` | `DSBillingManagement` |
| Customer | https://github.com/FIWARE-TMForum/DSCUSTOMER | `develop` | `DSCustomerManagement` |
| Usage | https://github.com/FIWARE-TMForum/DSUSAGEMANAGEMENT | `develop` | `DSUsageManagement` |

To install these APIs, you are required to install:
* Glassfish 4 or above
* MySQL

Once that you have installed Glassfish, you are required to include the MySQL library. To do so,
download the file `mysql-connector-java-VERSION-bin.jar` (VERSION < 6) and copy it to
`<GLASSFISH_PATH>/glassfish/domains/domain1/lib`.

To start Glassfish, run the following commands:

```
cd <GLASSFISH_PATH>/bin
./asadmin start-domain
```

> Note: In case you experience problems configuring the data base, we recommend you to install
Glassfish 5.

### Recommendations

1. Before compiling the APIs, check the `src/main/resources/META-INF/persistence.xml` file. There
are some APIs that use the same JNDI but you are required to use a different one for each API. In
case the JNDI Name is already chosen, change it for a new one.
2. Before compiling the Product Ordering API, move the
`src/main/java/org/tmf/dsmapi/settings.properties` file to `src/main/resources/settings.properties`.
3. Some APIs are configured to reload the database when they are restarted. If you do not desire
this behavior, modify the `src/main/resources/META-INF/persistence.xml` and remove these lines
before compiling the project:

```
<provider>org.eclipse.persistence.jpa.PersistenceProvider</provider>
...
<property name="eclipselink.ddl-generation" value="drop-and-create-tables"/>
<property name="eclipselink.logging.level" value="FINE"/>
```

### Installation

Bearing in mind the previous recommendations and once that Glassfish is running, it is time to
install all the TMForum APIs. To do so, you have to repeat the following steps for each one:

1. Clone the repository of the API you want to install
2. Move to the folder where the API has been downloaded
3. Checkout to the appropriate branch (the one indicated above)
4. Execute `mvn install`: This will create a WAR file in the `target` folder
5. Create a Database in your MySQL instance (i.e. `CREATE DATABASE DATABASE_NAME`)
6. Go to `http://localhost:4848` (Glassfish Administration Console)
7. Create a new JDBC Connection Pool
 1. Resource Type: `java.sql.Driver`
 2. Database Driver Vendor: `MySQL`
 3. URL: `jdbc:mysql://HOST:PORT/DATABASE_NAME` (e.g. `jdbc:mysql://localhost:3306/billing`)
 4. User: The one you choose at the time of installing the Database
 5. Password: The one you choose at the time of installing the Database
8. Create a JDBC Resource:
 1. JNDI Name: Check the property `jta-data-source` of the file
 `src/main/resources/META-INF/persistence.xml` included in the API you want to install
 2. Pool Name: The one you have created in the previous step
9. Deploy a new Application:
 1. Location: The WAR you have generated in the 4th step
 2. Context Root: Whatever you want. We recommend you to use the Context Root proposed above.

RSS
---

> Note: Java 8 is required to compile this project

1. Clone the Repository: `https://github.com/FIWARE-TMForum/business-ecosystem-rss`
2. Move to the folder where the repository has been cloned
3. Checkout to `develop`
4. Compile it: `mvn install -DskipTests`
5. Execute:
```
sudo mkdir /etc/default/rss/
sudo cp properties/database.properties /etc/default/rss/database.properties
sudo cp properties/oauth.properties /etc/default/rss/oauth.properties
```
6. Create a new database for the RSS in your MySQL instance (e.g. `CREATE DATABASE RSS`)
7. Modify the file `/etc/default/rss/database.properties` and set up the database accordingly
8. Add the following lines to the `etc/default/rss/oauth.properties` file:
```
config.sellerRole=seller
config.aggregatorRole=aggregator
```
9. Deploy the RSS in Glassfish:
 1. Location: `<RSS_CLONE_DIRECTORY>/fiware-rss/target/DSRevenueSharing.war`
 2. Context Root: `DSRevenueSharing`

Business Charging BackEnd
-------------------------
Before installing this part, you have to bean in mind some details:
1. The host and the port where the proxy (that you will install in the following section) will
run. For example, you can use `127.0.0.1:8000`.
2. The port where the Charing BackEnd will run. For example, you can use `8004`.

Once that you have considered the previous recommendations, follow these steps:

1. Clone the Repository: `https://github.com/FIWARE-TMForum/business-ecosystem-charging-backend`
2. Move to the folder where the repository has been cloned
3. Checkout to `develop`
4. Execute:
```
sudo ./resolve-basic-dep.sh
export WORKSPACE=`pwd`
virtualenv virtenv
source virtenv/bin/activate
./python-dep-install.sh
cd src
```
5. Modify the `settings.py` file.
 1. Configure `DATABASES`.`default` accordingly. If you have run the command to install the
 dependencies, you can avoid this step as the default configuration is valid.
 2. Modify `WSTOREMAIL` and set up an appropriate e-mail address
 3. If you want to activate the e-mail notifications, configure `WSTOREMAILUSER`,
 `WSTOREMAILPASS` and `SMTPSERVER` accordingly.
 4. Modify `PAYMENT_METHOD` and set its value to `paypal`
6. Execute the following commands. Here you have to use the values you have selected before
starting to run these steps and replace `PROXY_HOST`, `PROXY_PORT` and `BACK_END_PORT` by those
values.
```
./manage.py createsite external http://<PROXY_HOST>:<PROXY_PORT>
./manage.py createsite internal http://127.0.0.1:<BACK_END_PORT>
```

To execute this BackEnd, activate your virtualenv (`source virtenv/bin/activate`) and run
(in the `src` folder):
```
./manage.py runserver <BACK_END_PORT>
```
**Note:** Replace `BACK_END_PORT` by the selected port.

Business Ecosystem Logic Proxy
------------------------------

You are required to install NodeJS and NPM to run this software.

1. Clone the repository `https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy`
2. Move the directory where the repository has been cloned
3. Checkout to `develop`
4. Execute `npm intall`
5. Execute `cp config.js.template config.js`
6. Modify `config.js` file:
 * `config.port = <PROXY_PORT>`
 * `config.proxyPrefix = ''`
 * `config.appHost = '127.0.0.1'`
 * `config.endpoints.catalog.path = <PRODUCT_CATALOG_CONTEXT_ROOT>` (generally `DSProductCatalog`)
 * `config.endpoints.catalog.port = <GLASSFISH_PORT>` (generally 8080)
 * `config.endpoints.ordering.path = <PRODUCT_ORDERING_CONTEXT_ROOT>` (generally `DSProductOrdering`)
 * `config.endpoints.ordering.port = <GLASSFISH_PORT>` (generally 8080)
 * `config.endpoints.inventory.path = <PRODUCT_INVENTORY_CONTEXT_ROOT>` (generally `DSProductInventory`)
 * `config.endpoints.inventory.port = <GLASSFISH_PORT>` (generally 8080)
 * `config.endpoints.party.path = <PARTY_CONTEXT_ROOT>` (generally `DSPartyManagement`)
 * `config.endpoints.party.port = <GLASSFISH_PORT>` (generally 8080)
 * `config.endpoints.billing.path = <BILLING_CONTEXT_ROOT>` (generally `DSBillingManagement`)
 * `config.endpoints.billing.port = <GLASSFISH_PORT>` (generally 8080)
 * `config.endpoints.customer.path = <CUSTOMER_CONTEXT_ROOT>` (generally `DSCustomerManagement`)
 * `config.endpoints.customer.port = <GLASSFISH_PORT>` (generally 8080)
 * `config.endpoints.charging.path = `charging`
 * `config.endpoints.charging.port = <BACK_END_PORT>` (if you followed the recommendations it should be `8004`)
 * `config.endpoints.rss.path = <RSS_CONTEXT_ROOT>` (generally `DSRevenueSharing`)
 * `config.endpoints.rss.port = <GLASSFISH_PORT>` (generally 8080)
 * `config.endpoints.usage.path = <USAGE_CONTEXT_ROOT>` (generally `DSUsageManagement`)
 * `config.endpoints.usage.port = <GLASSFISH_PORT>` (generally 8080)
7. Go to `https://account.lab.fiware.org` and create an application:
 * URL: `http://<PROXY_HOST>:<PROXY_PORT>`
 * Callback URL: `http://<PROXY_HOST>:<PROXY_PORT>/auth/fiware/callback`
 * Create a role to this application called `seller`
 * Attach this role to the users you prefer
 8. Modify `config.js` file:
 * `config.oauth2.clientID`: The client ID that you got when you created the Application
 * `config.oauth2.clientSecret`: The client Secret that you got when you created the Application
 * `config.oauth2.callbackURL = http://<PROXY_HOST>:<PROXY_PORT>/auth/fiware/callback`

 Once that all is configured, you can run the proxy by executing:
 ```
 node server.js
 ```
 The server will run in the port you have selected, so you can go to
 http://<PROXY_HOST>:<PROXY_PORT> and start to create your own offerings.
