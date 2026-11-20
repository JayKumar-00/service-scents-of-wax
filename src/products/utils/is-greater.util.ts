import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsGreaterThan(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isGreaterThan',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];

          // if (value == null) return true; // allow optional

          // return value > relatedValue;

          // Only validate if both values are defined
          if (
            value !== null &&
            value !== undefined &&
            relatedValue !== null &&
            relatedValue !== undefined
          ) {
            return Number(value) > Number(relatedValue);
          }
          return true; // skip validation if one side is missing
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          return `${args.property} must be greater than ${relatedPropertyName}`;
        },
      },
    });
  };
}
