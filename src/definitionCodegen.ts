import { IDefinitionProperties, IDefinitions, IDefinitionProperty } from './baseInterfaces'
import { refClassName, toBaseType, getGenericsClassNames, isGenerics } from './utils'
import camelcase from 'camelcase';

export interface IDefinitionsClasses {
  [key: string]: {
    isGeneric: boolean
    value: string
  }
}

function propTrueType(v: IDefinitionProperty, isGenericType: boolean) {
  let propType = ''
  let isEnum = false
  if (v.$ref) {
    // 是引用类型
    propType = refClassName(v.$ref)
  }
  //是个数组
  else if (v.items) {
    if (v.items.$ref) {
      // 是个引用类型
      propType = refClassName(v.items.$ref) + '[]'
    } else {
      if (v.items.type === "array") {
        propType = propTrueType(v.items, isGenericType) + '[]'
      } else {
        propType = toBaseType(v.items.type) + '[]'
      }
    }
  }
  // 是个枚举
  else if (v.enum) {
    isEnum = true
    propType = v.type === 'string' ?
      v.enum.map(item => `${item}='${item}'`).join(',') :
      v.enum.map(item => `${item}=${item}`).join(',')
  }
  // 基本类型
  else {
    propType = toBaseType(v.type)
  }
  return { propType, isEnum }
}

/**
 * 生成类定义
 * @param className class名称
 * @param properties 属性
 * @param isGenericsType 是否是泛型接口
 */
function createDefinitionClass(
  className: string,
  properties: IDefinitionProperties,
  isGenericType: boolean = false,
  hasDefaultGenericType = false
) {
  let propsStr = ''
  let constructorStr = ''
  let genericsType = ''
  /** 枚举值 */
  let enums = []
  const propertiesEntities = Object.entries(properties)
  for (const [k, v] of propertiesEntities) {
    let { propType, isEnum } = propTrueType(v, isGenericType);
    if (isEnum) {
      let enumName = `Enum${className}${camelcase(k, { pascalCase: true })}`
      enums.push({
        name: enumName, text: `export enum ${enumName}{
        ${propType}
      }`})
      propType = enumName
    }
    propsStr += `
    /** ${v.description || ''} */
    ${k}:${propType};\n
    `
    constructorStr += `this['${k}'] = data['${k}'];\n`
    // 判断是不是泛型类型
    genericsType = isGenericType
      ? hasDefaultGenericType && propertiesEntities.length
        ? `<T=${toBaseType(v.type)}>`
        : '<T>'
      : ''
  }

  return {
    enums,
    model: `
  export class ${className}${genericsType} {
    ${propsStr}
    constructor(data?:any){
      if(data){
        ${constructorStr}
      }
    }
  }
  `
  }
}

export function definitionsCodeGen(definitions: IDefinitions): string {
  let definitionsModels: IDefinitionsClasses = {}
  for (const [k, v] of Object.entries(definitions)) {
    // 是否是泛型类型 PagedResultDto[UserListDto]
    // if (isGenerics(k) && v.type === 'object') {
    //   const { interfaceClassName, TClassName } = getGenericsClassNames(k)
    //   // if (definitionsModels[interfaceClassName] == null) {
    //   definitionsModels[interfaceClassName] = {
    //     isGeneric: true,
    //     value: createDefinitionClass(interfaceClassName, v.properties, true)
    //   }
    //   // }
    // } else {
    // if (definitionsModels[k] && definitionsModels[k].isGeneric) {
    //   definitionsModels[k] = {
    //     isGeneric: true,
    //     value: createDefinitionClass(k, v.properties, true, true)
    //   }
    // } else {
    let className = refClassName(k)
    const { enums, model } = createDefinitionClass(className, v.properties)


    enums.forEach(item => {
      definitionsModels[item.name] = {
        isGeneric: false,
        value: item.text
      }
    })

    definitionsModels[k] = {
      isGeneric: false,
      value: model
    }
    // }
    // }
  }

  let definitionsClasses = Object.values(definitionsModels)
    .map(item => item.value)
    .join('')

  return definitionsClasses
}
