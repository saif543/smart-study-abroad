"""
cost_calculator.py
------------------
Full cost of study breakdown calculator.
Reads cost_of_living.json and computes monthly/yearly/total costs
for a given university + country + city + preferences.
"""

import json
import os

_DATA_PATH = os.path.join(os.path.dirname(__file__), "cost_of_living.json")

def _load() -> dict:
    with open(_DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def get_countries() -> list[str]:
    return list(_load()["countries"].keys())


def get_cities(country: str) -> list[str]:
    data = _load()
    cities = list(data["countries"].get(country, {}).get("cities", {}).keys())
    return [c for c in cities if c != "default"]


def calculate(
    tuition_yearly: float,
    country: str,
    city: str = "default",
    housing_type: str = "housing_oncampus_shared",
    meal_plan: str = "none",
    program_years: float = 2.0,
    include_uni_extras: bool = True,
) -> dict:
    """
    Calculate full cost breakdown.

    Parameters:
        tuition_yearly      Annual tuition in local currency
        country             e.g. "USA", "UK", "Canada"
        city                City name or "default"
        housing_type        One of: housing_oncampus_shared / housing_oncampus_single
                                    housing_offcampus_shared / housing_offcampus_single
        meal_plan           One of: none / basic / standard / full
        program_years       Program duration in years (e.g. 2.0)
        include_uni_extras  Include student activity / tech / library fees

    Returns:
        Full breakdown dict with monthly, year1, year2+, total costs
    """

    data        = _load()
    countries   = data["countries"]
    meal_plans  = data["meal_plan_options"]
    extras      = data["university_extras"]["typical_fees"]

    if country not in countries:
        return {"error": f"Country '{country}' not found. Available: {list(countries.keys())}"}

    country_data = countries[country]
    cities_data  = country_data["cities"]
    city_data    = cities_data.get(city) or cities_data.get("default", {})
    visa_data    = country_data["visa"]
    setup_data   = country_data["one_time_setup"]
    currency     = country_data["currency_symbol"]

    # ── 1. University costs (per year) ───────────────────────────────────────
    uni_costs = {
        "tuition":            tuition_yearly,
        "health_insurance":   visa_data.get("health_insurance_yearly", 0),
    }
    if include_uni_extras:
        uni_costs["student_activity_fee"] = extras["student_activity_fee"]
        uni_costs["technology_fee"]       = extras["technology_fee"]
        uni_costs["library_fee"]          = extras["library_fee"]
        uni_costs["health_center_fee"]    = extras["health_center_fee"]

    uni_total_yearly = sum(uni_costs.values())

    # ── 2. Housing (per month → year) ────────────────────────────────────────
    housing_monthly = city_data.get(housing_type, 0)
    housing_label   = data["housing_type_labels"].get(housing_type, housing_type)
    housing_yearly  = housing_monthly * 12

    # ── 3. Meal plan (per month → year) ──────────────────────────────────────
    meal_monthly  = meal_plans.get(meal_plan, {}).get("monthly_cost", 0)
    meal_label    = meal_plans.get(meal_plan, {}).get("label", meal_plan)
    meal_yearly   = meal_monthly * 12

    # ── 4. Living costs (per month → year) ───────────────────────────────────
    # If meal plan active, skip groceries (covered by plan)
    living_items = {}
    if meal_plan == "none":
        living_items["Food & groceries"] = city_data.get("food_groceries", 0)
        living_items["Eating out"]        = city_data.get("eating_out", 0)
    elif meal_plan in ("basic", "standard"):
        living_items["Eating out (extra)"] = city_data.get("eating_out", 0) // 2

    living_items["Transport"]         = city_data.get("transport_monthly_pass", 0)
    living_items["Phone plan"]        = city_data.get("phone_plan", 0)
    living_items["Internet"]          = city_data.get("internet", 0)
    living_items["Personal/clothing"] = city_data.get("personal_clothing", 0)
    living_items["Entertainment"]     = city_data.get("entertainment", 0)
    living_items["Utilities"]         = city_data.get("utilities", 0)

    living_monthly = sum(living_items.values())
    living_yearly  = living_monthly * 12

    # ── 5. One-time costs (Year 1 only) ──────────────────────────────────────
    flight_mid = (setup_data["flight_estimate_min"] + setup_data["flight_estimate_max"]) // 2
    one_time = {
        "Visa application fee":  visa_data.get("student_visa_fee", 0),
        "SEVIS fee":             visa_data.get("sevis_fee", 0),
        "Flight (estimate)":     flight_mid,
        "Bedding & kitchen setup": setup_data.get("bedding_kitchen_setup", 0),
        "Textbooks & supplies":  setup_data.get("textbooks_supplies", 0),
        "Orientation fee":       extras.get("orientation_fee", 0),
    }
    # Remove zero items
    one_time = {k: v for k, v in one_time.items() if v > 0}
    one_time_total = sum(one_time.values())

    # ── 6. Totals ─────────────────────────────────────────────────────────────
    recurring_monthly = (
        (uni_total_yearly / 12) +
        housing_monthly +
        meal_monthly +
        living_monthly
    )

    year1_total     = uni_total_yearly + housing_yearly + meal_yearly + living_yearly + one_time_total
    year2_plus      = uni_total_yearly + housing_yearly + meal_yearly + living_yearly
    total_program   = year1_total + (year2_plus * max(0, program_years - 1))

    # ── 7. Build response ─────────────────────────────────────────────────────
    return {
        "currency":         currency,
        "country":          country,
        "city":             city if city != "default" else f"{country} (average)",
        "housing_type":     housing_label,
        "meal_plan":        meal_label,
        "program_years":    program_years,

        "breakdown": {
            "university_costs": {
                "items":       uni_costs,
                "yearly_total": round(uni_total_yearly),
            },
            "housing": {
                "type":         housing_label,
                "monthly":      housing_monthly,
                "yearly_total": housing_yearly,
            },
            "meal_plan": {
                "type":         meal_label,
                "monthly":      meal_monthly,
                "yearly_total": meal_yearly,
            },
            "living_costs": {
                "items":        living_items,
                "monthly_total": round(living_monthly),
                "yearly_total":  round(living_yearly),
            },
            "one_time_costs": {
                "items":       one_time,
                "total":       round(one_time_total),
                "note":        "Year 1 only",
            },
        },

        "totals": {
            "monthly_recurring":   round(recurring_monthly),
            "year_1_total":        round(year1_total),
            "year_2_plus":         round(year2_plus),
            "total_program_cost":  round(total_program),
        },

        "visa_info": {
            "type":  visa_data.get("visa_type", ""),
            "notes": visa_data.get("notes", ""),
        },
    }
