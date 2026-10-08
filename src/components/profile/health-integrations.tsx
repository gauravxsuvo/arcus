"use client";
export function HealthIntegrations(){return <section className="feature-panel"><h2>Health integrations</h2><p className="feature-muted">Native integrations are being planned. No health data is sent.</p>{["Apple Health","Google Fit"].map(name=><label className="health-stub" key={name}><input type="checkbox" disabled/>{name}<span>Coming soon</span></label>)}</section>;}
