#!/usr/bin/env python
from os import getenv
import sys
import time
import socket

if getenv("OAUTH2_CLIENT_ID") is None:
    print("Environment variable OAUTH2_CLIENT_ID not set")
    sys.exit()

if getenv("OAUTH2_CLIENT_SECRET") is None:
    print("Environment variable OAUTH2_CLIENT_SECRET not set")
    sys.exit()

if getenv("GLASSFISH_PORT") is None:
    print("Environment variable GLASSFISH_PORT not set")
    sys.exit()

if getenv("GLASSFISH_HOST") is None:
    print("Environment variable GLASSFISH_HOST not set")
    sys.exit()

if getenv("CHARGING_PORT") is None:
    print("environment variable CHARGING_PORT not set")
    sys.exit()

if getenv("CHARGING_HOST") is None:
    print("environment variable CHARGING_HOST not set")
    sys.exit()

if getenv("BIZ_ECOSYS_HOST") is None:
    print("environment variable BIZ_ECOSYS_HOST not set")
    sys.exit()

if getenv("BIZ_ECOSYS_PORT") is None:
    print("environment variable BIZ_ECOSYS_PORT not set")
    sys.exit()

text = ""
with open("./config.js") as f:
    text = f.read()

# Include general configuration
port = {'matchport': "config.port = 80;",
        'port': "config.port = {};".format("8000")}

prefix = {'matchprefix': "config.proxyPrefix = '/proxy';",
          'prefix': 'config.proxyPrefix = ""'}

text = text.replace(port.get('matchport'), port.get('port'))
text = text.replace(prefix.get('matchprefix'), prefix.get('prefix'))

# Include OAuth configuration
text = text.replace("'clientSecret': '--client-secret--',",
                    "'clientSecret': '{}',".format(getenv("OAUTH2_CLIENT_SECRET")))

text = text.replace("'clientID': '--client-id--',",
                    "'clientID': '{}',".format(getenv("OAUTH2_CLIENT_ID")))

text = text.replace("'callbackURL': 'http://localhost/auth/fiware/callback',",
                    "'callbackURL': 'http://{}:{}/auth/fiware/callback',".format(getenv("BIZ_ECOSYS_HOST"), getenv("BIZ_ECOSYS_PORT")))

# Include APIs configuration
text = text.replace("'host': 'localhost',\n        'port': '8080'",
                    "'host': '{}',\n        'port': '{}'".format(getenv("GLASSFISH_HOST"), getenv("GLASSFISH_PORT")))

text = text.replace("'host': 'localhost',\n        'port': '8006'",
                    "'host': '{}',\n        'port': '{}'".format(getenv("CHARGING_HOST"), getenv("CHARGING_PORT")))

with open("./config.js", "w+") as f:
    f.write(text)

for i in range(20):
    try:
        time.sleep(5)
        print("Trying to connect to the database:.... ")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect(('127.0.0.1', 27017))
        sock.close()
        print("Successfully connected")
        break
    except:
        print("Connection failed, retrying in a few seconds...")
        continue
