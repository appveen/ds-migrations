function convert(definition) {
    let defList = [];
    if (definition && typeof definition == 'string') {
        definition = JSON.parse(definition);
    }
    if (Array.isArray(definition)) {
        return definition;
    }
    Object.keys(definition).forEach(key => {
        const def = definition[key];
        def.key = key;
        if (def.type === 'Object' || def.type === 'Array') {
            def.definition = convert(def.definition);
        }
        defList.push(def);
    });
    return defList;
}





module.exports.convert = convert;