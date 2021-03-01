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
        if (def.type === 'Date') {
        	def.properties["defaultTimezone"] = "Zulu"
        	def.properties["supportedTimezones"] = []
        }
        defList.push(def);
    });
    if(defList[0].properties.dataKey == "_id") defList[0]["type"] = "String"
    return defList;
}

let def = {
  "_id": {
    "prefix": "XCRODEF",
    "suffix": null,
    "padding": null,
    "counter": "1030",
    "properties": {
      "label": null,
      "readonly": false,
      "errorMessage": null,
      "name": "Defect ID",
      "required": false,
      "fieldLength": 0,
      "_description": null,
      "_typeChanged": null,
      "_isParrentArray": null,
      "_isGrpParentArray": null,
      "dataPath": "_id",
      "_detailedType": "",
      "dataKey": "_id"
    }
  },
  "additionalAttachment": {
    "type": "Array",
    "properties": {
      "name": "Additional Attachment",
      "fieldLength": 10,
      "_typeChanged": "Array",
      "dataKey": "additionalAttachment",
      "dataPath": "additionalAttachment"
    },
    "definition": {
      "_self": {
        "type": "File",
        "properties": {
          "name": "_self",
          "fieldLength": 10,
          "_typeChanged": "File",
          "fileType": "All"
        }
      }
    }
  }
}

async function init() {
	try {
		let convertedDef = convert(def)
		console.log(JSON.stringify(convertedDef, null, " "))
	} catch (_err) {
		console.log(_err.message)
	}
	// await client.close()
}

init()