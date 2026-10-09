const hasSpaces = /\s/g
type Value = string | boolean

const checkQuotes = (value: Value) => {
  const v = value
  console.log('v =', v)
  console.log('value =', value)
  console.log('v === value', v === value)
  console.log(hasSpaces.test(value as string), hasSpaces.test(v))
  console.log(hasSpaces.test(v as string), hasSpaces.test(value))
  console.log(hasSpaces.test(v as string) === hasSpaces.test(value))
}

checkQuotes('A B')
