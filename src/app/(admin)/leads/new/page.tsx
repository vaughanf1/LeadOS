import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { processLead } from "@/lib/pipeline";
import { PageHeader } from "@/components/PageHeader";

async function createTestLead(formData: FormData) {
  "use server";
  const get = (k: string) => {
    const v = formData.get(k);
    return v == null || v === "" ? null : String(v);
  };
  const toInt = (v: string | null) => (v ? parseInt(v.replace(/[^\d-]/g, ""), 10) : null);

  const lead = await prisma.lead.create({
    data: {
      fullName: get("fullName") ?? "Test Lead",
      phone: get("phone"),
      email: get("email"),
      postcode: get("postcode"),
      age: toInt(get("age")),
      propertyValue: toInt(get("propertyValue")),
      mortgageRemaining: toInt(get("mortgageRemaining")),
      urgency: get("urgency"),
      enquiryStage: get("enquiryStage"),
      loanPurpose: get("loanPurpose"),
      source: "manual",
      status: "NEW",
    },
  });
  await processLead(lead.id);
  redirect(`/leads/${lead.id}`);
}

export default function NewLeadPage() {
  return (
    <>
      <PageHeader
        title="Create test lead"
        subtitle="Manually push a lead through scoring + distribution. Useful for testing rules."
      />
      <form action={createTestLead} className="card max-w-2xl">
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full name" name="fullName" required defaultValue="John Smith" />
          <Field label="Phone" name="phone" defaultValue="+447900000000" />
          <Field label="Email" name="email" type="email" defaultValue="john@example.com" />
          <Field label="Postcode" name="postcode" defaultValue="W1A 1AA" />
          <Field label="Age" name="age" type="number" defaultValue="68" />
          <Field label="Property value (£)" name="propertyValue" type="number" defaultValue="350000" />
          <Field label="Mortgage remaining (£)" name="mortgageRemaining" type="number" defaultValue="20000" />
          <div>
            <label className="label">Urgency</label>
            <select name="urgency" className="input" defaultValue="immediately">
              <option value="immediately">Immediately</option>
              <option value="1-3 months">1-3 months</option>
              <option value="3-6 months">3-6 months</option>
              <option value="just researching">Just researching</option>
              <option value="no urgency">No urgency</option>
            </select>
          </div>
          <Field label="Enquiry stage" name="enquiryStage" defaultValue="ready to apply" />
          <Field label="Needs money for" name="loanPurpose" defaultValue="home improvements" />
        </div>
        <div className="px-6 pb-6 flex justify-end gap-2">
          <button type="submit" className="btn-primary">Create & process</button>
        </div>
      </form>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="input"
      />
    </div>
  );
}
