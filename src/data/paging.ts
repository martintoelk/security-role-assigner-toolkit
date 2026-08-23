export interface FetchPage { value: Record<string, unknown>[]; "@Microsoft.Dynamics.CRM.fetchxmlpagingcookie"?: string; }

export async function loadAllPages(fetchPage: (page: number, cookie?: string) => Promise<FetchPage>): Promise<Record<string, unknown>[]> {
    const records: Record<string, unknown>[] = [];
    let page = 1;
    let cookie: string | undefined;
    do {
        const response = await fetchPage(page, cookie);
        records.push(...response.value);
        cookie = response["@Microsoft.Dynamics.CRM.fetchxmlpagingcookie"];
        page += 1;
    } while (cookie);
    return records;
}
