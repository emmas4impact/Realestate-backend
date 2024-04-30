import { model, Schema } from "mongoose";
import valid from "validator";

const tenantSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    surname: {
      type: String,
      required: true,
    },
    Employer: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    property: {
      type: Schema.Types.ObjectId,
      ref: "house",
    }, //VALIDATION
  },

  {
    timestamps: true,
  }
);

tenantSchema.post("validate", function (error, doc, next) {
  if (error) {
    error.httpStatusCode = 400;
    next(error);
  } else {
    next();
  }
});

tenantSchema.post("save", function (error, doc, next) {
  if (error.name === "MongoError" && error.code === 11000) {
    error.httpStatusCode = 400;
    next(error);
  } else {
    next();
  }
});
const TenantModel = model("rent", tenantSchema);

export default TenantModel;
