import { request, type RequestOptions } from "@/lib/http-client";

export async function customInstance<T>(url: string, options?: RequestOptions): Promise<T> {
  return request<T>(url, options);
}

export default customInstance;
