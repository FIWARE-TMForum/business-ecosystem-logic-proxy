var reporters = require('jasmine-reporters');

// Create the reporter
var junitReporter = new reporters.JUnitXmlReporter({
    savePath: __dirname + '/../..',    // The main folder of the project
    consolidateAll: true,
    filePrefix: 'xunit'
});

// Add the reporter to Jasmine
jasmine.getEnv().addReporter(junitReporter);
