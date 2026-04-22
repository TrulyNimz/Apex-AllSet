package validator

import "github.com/go-playground/validator/v10"

var v = validator.New()

// Validate returns a map of field name → human-readable error message,
// or nil when the struct is valid.
func Validate(s any) map[string]string {
	err := v.Struct(s)
	if err == nil {
		return nil
	}

	errs := make(map[string]string)
	for _, e := range err.(validator.ValidationErrors) {
		errs[e.Field()] = msgForTag(e.Tag(), e.Param())
	}
	return errs
}

func msgForTag(tag, param string) string {
	switch tag {
	case "required":
		return "this field is required"
	case "email":
		return "invalid email address"
	case "min":
		return "value is too short (min " + param + ")"
	case "max":
		return "value is too long (max " + param + ")"
	case "url":
		return "invalid URL"
	default:
		return "invalid value"
	}
}
