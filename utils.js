function rand(index) {
    const i = Math.pow(10, index - 1);
    const j = Math.pow(10, index) - 1;
    return Math.floor(Math.random() * (j - i + 1)) + i;
}


module.exports.rand = rand;