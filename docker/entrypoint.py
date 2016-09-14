#!/usr/bin/env python
from os import getenv
import sys

if getenv("OAUTH2_CLIENT_ID") is None:
    print("environment variable OAUTH2_CLIENT_ID not set")
    sys.exit()

if getenv("OAUTH2_CLIENT_SECRET") is None:
    print("environment variable OAUTH2_CLIENT_SECRET not set")
    sys.exit()

if getenv("GLASSFISH_PORT") is None:
    print("environment variable GLASSFISH_PORT not set")
    sys.exit()

if getenv("CHARGING_PORT") is None:
    print("environment variable CHARGING_PORT not set")
    sys.exit()

if getenv("APIS_HOST") is None:
    print("environment variable APIS_HOST not set")
    sys.exit()

if getenv("BIZ_ECOSYS_HOST") is None:
    print("environment variable BIZ_ECOSYS_HOST not set")
    sys.exit()

if getenv("BIZ_ECOSYS_PORT") is None:
    print("environment variable BIZ_ECOSYS_PORT not set")
    sys.exit()

port = {'matchport': "config.port = 80;",
        'port': "config.port = {};".format("8000")}

prefix = {'matchprefix': "config.proxyPrefix = '/proxy';",
          'prefix': 'config.proxyPrefix = ""'}

app = {'matchapp': "config.appHost = '';",
       'port': 'config.appHost = "{}"'.format(getenv("APIS_HOST", "127.0.0.1"))}

text = ""
with open("./config.js") as f:
    text = f.read()


text = text.replace("'port': '8080'", "'port': '{}'".format(getenv('GLASSFISH_PORT')))
text = text.replace("'port': '8006'", "'port': '{}'".format(getenv('CHARGING_PORT')))


print(getenv("OAUTH2_CLIENT_SECRET"))
print(getenv("OAUTH2_CLIENT_ID"))

text = text.replace(port.get('matchport'), port.get('port'))
text = text.replace(prefix.get('matchprefix'), prefix.get('prefix'))
text = text.replace(app.get('matchapp'), app.get('port'))
text = text.replace("'clientSecret': '--client-secret--',",
                    "'clientSecret': '{}',".format(getenv("OAUTH2_CLIENT_SECRET")))
text = text.replace("'clientID': '--client-id--',",
                    "'clientID': '{}',".format(getenv("OAUTH2_CLIENT_ID")))
text = text.replace("'callbackURL': '--callback-url--',",
                    "'callbackURL': 'http://{}:{}/auth/fiware/callback',".format(getenv("BIZ_ECOSYS_HOST"), getenv("BIZ_ECOSYS_PORT")))

print(text)
with open("./config.js", "w+") as f:
    f.write(text)

# system("/business-ecosystem-logic-proxy/node-v4.5.0-linux-x64/bin/node server.js")
