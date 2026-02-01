const ResourceToken = artifacts.require("ResourceToken");
const truffleAssert = require("truffle-assertions");

contract("ResourceToken", (accounts) => {
  const owner = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];

  let contractInstance;

  beforeEach(async () => {
    contractInstance = await ResourceToken.new({ from: owner });
  });

  // -------------------------
  // 1. Mint autorisé
  // -------------------------
  it("doit permettre au owner de mint une ressource", async () => {
    await contractInstance.mintResource(
      user1,
      "Maison",
      "house",
      100,
      "QmHash1",
      { from: owner }
    );

    const balance = await contractInstance.balanceOf(user1);
    assert.equal(balance.toNumber(), 1, "La ressource n'a pas été mintée");
  });

  // -------------------------
  // 2. Limite de 4 ressources
  // -------------------------
  it("doit refuser plus de 4 ressources par utilisateur", async () => {
    for (let i = 0; i < 4; i++) {
      await contractInstance.mintResource(
        user1,
        `Ressource${i}`,
        "type",
        10,
        "QmHash",
        { from: owner }
      );
      // Respecter le cooldown entre deux mint pour le même utilisateur
      await timeTravel(6 * 60); // 6 minutes
    }

    await truffleAssert.reverts(
      contractInstance.mintResource(
        user1,
        "Ressource5",
        "type",
        10,
        "QmHash",
        { from: owner }
      ),
      "Limite atteinte"
    );
  });

  // -------------------------
  // 3. Cooldown entre actions
  // -------------------------
  it("doit bloquer une action pendant le cooldown", async () => {
    await contractInstance.mintResource(
      user1,
      "Maison",
      "house",
      100,
      "QmHash",
      { from: owner }
    );

    await truffleAssert.reverts(
      contractInstance.mintResource(
        user1,
        "Garage",
        "house",
        50,
        "QmHash",
        { from: owner }
      ),
      "Cooldown actif"
    );
  });

  // -------------------------
  // 4. Lock après acquisition
  // -------------------------
  it("doit bloquer un transfert pendant le lock time", async () => {
    await contractInstance.mintResource(
      user1,
      "Maison",
      "house",
      100,
      "QmHash",
      { from: owner }
    );

    // Attendre la fin du cooldown mais rester avant la fin du lock time
    await timeTravel(6 * 60); // 6 minutes

    await truffleAssert.reverts(
      contractInstance.transferResource(user2, 0, { from: user1 }),
      "Ressource verrouillee"
    );
  });

  // -------------------------
  // 5. Transfert valide après délais
  // -------------------------
  it("doit autoriser un transfert valide après cooldown et lock", async () => {
    await contractInstance.mintResource(
      user1,
      "Maison",
      "house",
      100,
      "QmHash",
      { from: owner }
    );

    // Avancer le temps (Ganache)
    await timeTravel(11 * 60); // 11 minutes

    await contractInstance.transferResource(user2, 0, { from: user1 });

    const newOwner = await contractInstance.ownerOf(0);
    assert.equal(newOwner, user2, "Le transfert n'a pas eu lieu");
  });

});

// --- Utilitaire pour avancer le temps ---
async function timeTravel(seconds) {
  await new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [seconds],
        id: new Date().getTime()
      },
      (err) => {
        if (err) return reject(err);
        web3.currentProvider.send(
          {
            jsonrpc: "2.0",
            method: "evm_mine",
            params: [],
            id: new Date().getTime()
          },
          (err2, res) => (err2 ? reject(err2) : resolve(res))
        );
      }
    );
  });
}
