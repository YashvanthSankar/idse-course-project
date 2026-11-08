import { redirect } from "next/navigation";

/** The method now lives on the pipeline page. */
export default function ModelAboutPage() {
  redirect("/model/pipeline");
}
