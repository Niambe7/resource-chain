const ResourceToken = artifacts.require("ResourceToken");

module.exports = function (deployer) {
  deployer.deploy(ResourceToken);
};
